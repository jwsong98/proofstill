import { loadConfig } from "../storage/config-loader.js";
import { readJson, writeJson } from "../storage/file-store.js";
import path from "node:path";
import { getActiveAppId, getTrackerRoot, readYaml } from "../storage/file-store.js";
import { resolveApp } from "../v2/config.js";
import { actorAuthStatus, resolveActorAuth } from "../v2/auth.js";
async function getV2App() {
    const raw = await readYaml("config.yaml");
    if (raw.version !== 2)
        return null;
    return resolveApp(path.dirname(getTrackerRoot()), getActiveAppId() ?? raw.defaultApp);
}
function extractByTokenPath(obj, tokenPath) {
    // tokenPath: "$.accessToken" or "$.data.token" etc.
    const parts = tokenPath.replace(/^\$\./, "").split(".");
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== "object") {
            throw new Error(`Cannot extract tokenPath "${tokenPath}": missing key "${part}"`);
        }
        current = current[part];
    }
    if (typeof current !== "string") {
        throw new Error(`Token at "${tokenPath}" is not a string`);
    }
    return current;
}
async function getProfile(profileName) {
    const config = await loadConfig();
    const profile = config.auth.profiles[profileName];
    if (!profile) {
        throw new Error(`Auth profile "${profileName}" not found in config.yaml`);
    }
    return { profile, baseUrl: config.server.baseUrl };
}
async function loadAuthCache() {
    return (await readJson("auth.json")) ?? {};
}
export async function login(profileName) {
    const v2App = await getV2App();
    if (v2App) {
        const result = await resolveActorAuth(v2App, profileName, true);
        if (!result.token)
            throw new Error(`Actor "${profileName}" does not use authentication`);
        return { token: result.token };
    }
    const { profile, baseUrl } = await getProfile(profileName);
    const url = baseUrl + profile.endpoint;
    const res = await fetch(url, {
        method: profile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile.credentials),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Login failed for profile "${profileName}": ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
    }
    const json = await res.json();
    const token = extractByTokenPath(json, profile.tokenPath);
    const expiresAt = typeof json.expiresAt === "string"
        ? json.expiresAt
        : undefined;
    const cache = await loadAuthCache();
    cache[profileName] = {
        token,
        expiresAt: expiresAt ?? "",
        note: profile.note,
    };
    await writeJson("auth.json", cache);
    return { token, expiresAt };
}
export async function getToken(profileName) {
    return (await getTokenWithEvidence(profileName)).token;
}
export async function getTokenWithEvidence(profileName, forceLogin = false, source = "login") {
    const v2App = await getV2App();
    if (v2App) {
        const result = await resolveActorAuth(v2App, profileName, forceLogin, source);
        if (!result.token)
            throw new Error(`Actor "${profileName}" does not use authentication`);
        return { token: result.token, evidence: result.evidence };
    }
    const cache = await loadAuthCache();
    const entry = cache[profileName];
    if (!forceLogin && entry?.token) {
        return { token: entry.token };
    }
    const result = await login(profileName);
    return { token: result.token };
}
export async function refreshOnUnauthorized(profileName) {
    return (await getTokenWithEvidence(profileName, true, "retry")).token;
}
export async function getAuthStatus() {
    const v2App = await getV2App();
    if (v2App) {
        const status = await actorAuthStatus(v2App);
        const actors = status.data?.actors ?? [];
        return Object.fromEntries(actors.map((actor) => [actor.actorId, { token: actor.cached ? "***" : "", expiresAt: actor.expiresAt ?? "", note: actor.label }]));
    }
    return loadAuthCache();
}
//# sourceMappingURL=auth-manager.js.map