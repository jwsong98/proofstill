import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadSpec } from "./spec.js";
import { configDiagnostics, resolveEnvValues } from "./config.js";
import { readRuntime } from "./environment.js";
function selectPath(value, jsonPath) {
    let current = value;
    for (const part of jsonPath.replace(/^\$\.?/, "").split(".").filter(Boolean)) {
        if (current == null || typeof current !== "object")
            return undefined;
        current = current[part];
    }
    return current;
}
function decodeJwtClaims(token) {
    const part = token.split(".")[1];
    if (!part)
        return undefined;
    try {
        return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    }
    catch {
        return undefined;
    }
}
function fingerprint(token) {
    return `sha256:${crypto.createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}
function cachePath(app, actorId) {
    if (!/^[A-Za-z0-9_-]+$/.test(actorId))
        throw new Error(`Invalid actor id "${actorId}"`);
    return path.join(app.runtimeRoot, "auth", `${actorId}.json`);
}
async function readCache(app, actorId) {
    try {
        return JSON.parse(await fs.readFile(cachePath(app, actorId), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return null;
        throw error;
    }
}
async function writeCache(app, actorId, entry) {
    const filePath = cachePath(app, actorId);
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(entry, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(temp, 0o600);
    await fs.rename(temp, filePath);
}
function expiryFor(token, response, expiresAtPath, maxAgeSeconds) {
    const explicit = expiresAtPath ? selectPath(response, expiresAtPath) : undefined;
    if (typeof explicit === "string" && !Number.isNaN(Date.parse(explicit)))
        return explicit;
    const exp = decodeJwtClaims(token)?.exp;
    if (typeof exp === "number")
        return new Date(exp * 1000).toISOString();
    return new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
}
async function findLoginRoute(app, operationId) {
    const spec = await loadSpec(app.contractPath);
    const paths = spec.paths;
    for (const [apiPath, item] of Object.entries(paths)) {
        if (!item || typeof item !== "object")
            continue;
        for (const [method, operation] of Object.entries(item)) {
            if (operation && typeof operation === "object" && operation.operationId === operationId) {
                return { method: method.toUpperCase(), path: apiPath };
            }
        }
    }
    throw new Error(`Unknown login operationId "${operationId}"`);
}
export async function actorAuthStatus(app) {
    const actors = await Promise.all(Object.entries(app.app.auth?.actors ?? {}).map(async ([actorId, actor]) => {
        const entry = await readCache(app, actorId);
        return {
            actorId,
            label: actor.label,
            meaning: actor.meaning,
            cached: Boolean(entry),
            expiresAt: entry?.expiresAt,
            valid: entry ? Date.parse(entry.expiresAt) > Date.now() + (actor.cache?.expirySkewSeconds ?? 60) * 1000 : false,
            tokenFingerprint: entry?.tokenFingerprint,
        };
    }));
    return { ok: true, code: "AUTH_STATUS", data: { appId: app.appId, actors }, diagnostics: configDiagnostics(app.app) };
}
export async function forgetActorAuth(app, actorId) {
    await fs.unlink(cachePath(app, actorId)).catch((error) => {
        if (error.code !== "ENOENT")
            throw error;
    });
    return { ok: true, code: "AUTH_CACHE_FORGOTTEN", data: { appId: app.appId, actorId } };
}
export async function resolveActorAuth(app, actorId, forceLogin = false, source = "login") {
    const selected = actorId ?? app.app.auth?.defaultActor;
    if (!selected || selected === "none")
        return { evidence: { id: "none", label: "Anonymous", tokenSource: "none" } };
    const actor = app.app.auth?.actors?.[selected];
    if (!actor)
        throw new Error(`Actor "${selected}" is not defined for app "${app.appId}"`);
    const runtime = await readRuntime(app);
    const baseUrl = runtime?.baseUrl ?? app.app.server?.baseUrl;
    if (!baseUrl)
        throw new Error(`No baseUrl available for app "${app.appId}"`);
    const scopeKey = actor.cache?.scope === "origin" ? new URL(baseUrl).origin : app.appId;
    const cached = await readCache(app, selected);
    const skew = (actor.cache?.expirySkewSeconds ?? 60) * 1000;
    if (!forceLogin && cached && cached.scopeKey === scopeKey && Date.parse(cached.expiresAt) > Date.now() + skew) {
        return { token: cached.token, evidence: { id: selected, label: actor.label, meaning: actor.meaning, tokenSource: "cache_hit", tokenFingerprint: cached.tokenFingerprint } };
    }
    const route = actor.login.endpoint
        ? { path: actor.login.endpoint, method: actor.login.method ?? "POST" }
        : await findLoginRoute(app, actor.login.operationId ?? "");
    const credentials = resolveEnvValues(actor.credentials ?? {});
    const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
    });
    if (!response.ok)
        throw new Error(`Login failed for actor "${selected}": HTTP ${response.status}`);
    const body = await response.json();
    const token = selectPath(body, actor.login.tokenPath);
    if (typeof token !== "string")
        throw new Error(`Actor "${selected}" tokenPath did not resolve to a string`);
    const claims = decodeJwtClaims(token);
    for (const [key, expected] of Object.entries(actor.verify?.expectedClaims ?? {})) {
        if (claims?.[key] !== expected)
            throw new Error(`AUTH_CONTEXT_MISMATCH: actor "${selected}" expected claim ${key}`);
    }
    const entry = {
        actorId: selected,
        token,
        tokenFingerprint: fingerprint(token),
        obtainedAt: new Date().toISOString(),
        expiresAt: expiryFor(token, body, actor.login.expiresAtPath, actor.cache?.maxAgeSeconds ?? 3600),
        scopeKey,
    };
    await writeCache(app, selected, entry);
    return { token, evidence: { id: selected, label: actor.label, meaning: actor.meaning, tokenSource: source, tokenFingerprint: entry.tokenFingerprint } };
}
export async function callWithActor(options) {
    const runtime = await readRuntime(options.app);
    const baseUrl = runtime?.baseUrl ?? options.app.app.server?.baseUrl;
    if (!baseUrl)
        throw new Error(`No baseUrl available for app "${options.app.appId}"`);
    const perform = async (force) => {
        const auth = await resolveActorAuth(options.app, options.actorId, force, force ? "retry" : "login");
        const headers = { ...options.headers };
        if (auth.token)
            headers.authorization = `Bearer ${auth.token}`;
        if (options.body != null && !headers["content-type"])
            headers["content-type"] = "application/json";
        const response = await fetch(`${baseUrl}${options.path}`, { method: options.method, headers, body: options.body == null ? undefined : JSON.stringify(options.body) });
        const text = await response.text();
        let body = text;
        try {
            body = JSON.parse(text);
        }
        catch { /* keep text */ }
        const responseHeaders = {};
        response.headers.forEach((value, key) => { responseHeaders[key] = value; });
        return { status: response.status, headers: responseHeaders, body, actor: auth.evidence };
    };
    const first = await perform(false);
    if (first.status !== 401 || first.actor.id === "none")
        return first;
    await forgetActorAuth(options.app, first.actor.id);
    return perform(true);
}
//# sourceMappingURL=auth.js.map