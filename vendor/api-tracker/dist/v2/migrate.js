import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { createAdapterScaffolds } from "./adapter.js";
import { readRawConfig, trackerRootFor } from "./config.js";
function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
// Existence check that does not follow symlinks, so a symlink (even a broken
// one) is still detected and moved rather than silently skipped.
async function lexists(filePath) {
    try {
        await fs.lstat(filePath);
        return true;
    }
    catch {
        return false;
    }
}
// Move a file to `dest`. When `src` is a symlink, recreate the link at the new
// location with its target re-based, so it keeps pointing at the same file.
// A plain fs.rename would preserve the literal (now-wrong) relative target,
// breaking the ../_api-tracker/*.yaml source-of-truth symlink workflow.
// Discover every flow definition sitting at the tracker root (plain files or
// symlinks into ../_api-tracker), e.g. flow.yaml, flow-messenger.yaml,
// signup-flow.yaml. Timestamped backups like flow.yaml.bak-... are excluded
// because they do not end in .yaml.
async function discoverFlowFiles(trackerRoot) {
    const entries = await fs.readdir(trackerRoot, { withFileTypes: true }).catch(() => []);
    return entries
        .filter((e) => (e.isFile() || e.isSymbolicLink()) && /flow/i.test(e.name) && /\.ya?ml$/i.test(e.name))
        .map((e) => e.name)
        .sort();
}
async function moveEntry(src, dest) {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const stat = await fs.lstat(src);
    if (stat.isSymbolicLink()) {
        const rawTarget = await fs.readlink(src);
        const rebased = path.isAbsolute(rawTarget)
            ? rawTarget
            : path.relative(path.dirname(dest), path.resolve(path.dirname(src), rawTarget));
        await fs.symlink(rebased, dest);
        await fs.unlink(src);
        return;
    }
    await fs.rename(src, dest);
}
async function atomicText(filePath, text, mode) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, text, { encoding: "utf8", mode });
    if (mode != null)
        await fs.chmod(temp, mode);
    await fs.rename(temp, filePath);
}
function redact(value) {
    if (Array.isArray(value))
        return value.map(redact);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
        key,
        /token|password|secret|credential/i.test(key) ? "***" : redact(child),
    ]));
}
export async function migrateToV2(workspaceRoot, options = {}) {
    const root = path.resolve(workspaceRoot);
    const trackerRoot = trackerRootFor(root);
    const marker = path.join(trackerRoot, ".migration-v2.json");
    if (await exists(marker)) {
        return { ok: true, code: "MIGRATION_ALREADY_APPLIED", data: JSON.parse(await fs.readFile(marker, "utf8")) };
    }
    const raw = await readRawConfig(root);
    if (raw.version === 2)
        return { ok: true, code: "CONFIG_ALREADY_V2", data: { workspaceRoot: root } };
    const appId = "default";
    const appRootValue = raw.db?.resetWorkingDir && raw.db.resetWorkingDir !== "." ? raw.db.resetWorkingDir : ".";
    const flowFiles = await discoverFlowFiles(trackerRoot);
    const namedFlows = flowFiles.filter((name) => name !== "flow.yaml");
    const v2 = {
        version: 2,
        defaultApp: appId,
        apps: {
            [appId]: {
                root: appRootValue,
                adapterDir: ".api-tracker/scripts",
                server: { baseUrl: raw.server?.baseUrl },
                specs: {
                    contract: `.api-tracker/apps/${appId}/openapi.contract.yaml`,
                    generated: `.api-tracker/apps/${appId}/generated/openapi.json`,
                    ignorePointers: ["/info/version", "/servers"],
                },
                flow: `.api-tracker/apps/${appId}/flow.yaml`,
                ...(namedFlows.length
                    ? { flows: Object.fromEntries(namedFlows.map((name) => [name.replace(/\.ya?ml$/i, ""), `.api-tracker/apps/${appId}/${name}`])) }
                    : {}),
                lifecycle: { timeoutMs: 60_000, invalidateAuthOnReset: false },
                auth: {
                    defaultActor: Object.keys(raw.auth?.profiles ?? {})[0],
                    actors: Object.fromEntries(Object.entries(raw.auth?.profiles ?? {}).map(([actorId, profile]) => [actorId, {
                            label: profile.note || actorId,
                            meaning: { description: profile.note || actorId },
                            credentials: profile.credentials,
                            login: { endpoint: profile.endpoint, method: profile.method, tokenPath: profile.tokenPath },
                            cache: { scope: "app", maxAgeSeconds: 3600, expirySkewSeconds: 60 },
                        }])),
                },
            },
        },
    };
    const actions = [
        "Back up the complete .api-tracker directory",
        "Write config.yaml version 2",
        `Move ${flowFiles.length || 1} flow file(s) and the openapi spec under apps/${appId}`,
        `Move scenarios and sessions under app ${appId}`,
        "Move auth tokens to runtime cache files with mode 0600",
        "Create five failing adapter scaffolds",
    ];
    if (!options.apply) {
        return { ok: true, code: "MIGRATION_DRY_RUN", data: { workspaceRoot: root, appId, actions, config: redact(v2) } };
    }
    const backupPath = path.join(root, `.api-tracker-backup-${timestamp()}`);
    await fs.cp(trackerRoot, backupPath, { recursive: true, errorOnExist: true });
    const appDir = path.join(trackerRoot, "apps", appId);
    await fs.mkdir(appDir, { recursive: true });
    for (const name of flowFiles) {
        const src = path.join(trackerRoot, name);
        if (await lexists(src))
            await moveEntry(src, path.join(appDir, name));
    }
    const legacySpec = path.resolve(trackerRoot, raw.openapi?.specPath ?? "openapi.yaml");
    const contractPath = path.join(appDir, "openapi.contract.yaml");
    if (await exists(legacySpec))
        await fs.copyFile(legacySpec, contractPath);
    const scenarios = path.join(trackerRoot, "scenarios");
    const appScenarios = path.join(appDir, "scenarios");
    if (await exists(scenarios)) {
        await fs.mkdir(path.dirname(appScenarios), { recursive: true });
        await fs.rename(scenarios, appScenarios);
    }
    const sessions = path.join(trackerRoot, "sessions");
    const appSessions = path.join(sessions, appId);
    if (await exists(sessions) && !(await exists(appSessions))) {
        const tempSessions = path.join(trackerRoot, `.sessions-${process.pid}`);
        await fs.rename(sessions, tempSessions);
        await fs.mkdir(sessions, { recursive: true });
        await fs.rename(tempSessions, appSessions);
        await migrateEdgeActors(appSessions, raw.auth?.profiles ?? {});
    }
    const legacyAuth = path.join(trackerRoot, "auth.json");
    if (await exists(legacyAuth)) {
        const cache = JSON.parse(await fs.readFile(legacyAuth, "utf8"));
        for (const [actorId, entry] of Object.entries(cache)) {
            if (!entry.token || !/^[A-Za-z0-9_-]+$/.test(actorId))
                continue;
            const filePath = path.join(trackerRoot, "runtime", appId, "auth", `${actorId}.json`);
            const tokenFingerprint = `sha256:${(await import("node:crypto")).createHash("sha256").update(entry.token).digest("hex").slice(0, 16)}`;
            await atomicText(filePath, `${JSON.stringify({ actorId, token: entry.token, tokenFingerprint, obtainedAt: new Date().toISOString(), expiresAt: entry.expiresAt || new Date(Date.now() + 3600_000).toISOString(), scopeKey: appId }, null, 2)}\n`, 0o600);
        }
        await fs.unlink(legacyAuth);
    }
    const appRoot = path.resolve(root, appRootValue);
    const createdAdapters = await createAdapterScaffolds(appRoot, ".api-tracker/scripts");
    await atomicText(path.join(trackerRoot, "config.yaml"), YAML.stringify(v2));
    await atomicText(path.join(trackerRoot, ".gitignore"), "runtime/\napps/*/generated/\n*.log\n");
    const result = { appliedAt: new Date().toISOString(), backupPath, appId, createdAdapters };
    await atomicText(marker, `${JSON.stringify(result, null, 2)}\n`);
    return {
        ok: true,
        code: "MIGRATION_APPLIED",
        data: result,
        diagnostics: [{ code: "PLAINTEXT_CREDENTIAL_DEPRECATED", severity: "warning", message: "Existing plaintext credentials were preserved; replace them with ${env.*} references" }],
        artifacts: [{ kind: "backup", path: backupPath }, { kind: "config", path: path.join(trackerRoot, "config.yaml") }],
    };
}
async function migrateEdgeActors(sessionRoot, profiles) {
    const sessions = await fs.readdir(sessionRoot, { withFileTypes: true }).catch(() => []);
    for (const session of sessions) {
        if (!session.isDirectory())
            continue;
        const edgeRoot = path.join(sessionRoot, session.name, "edges");
        const files = await fs.readdir(edgeRoot).catch(() => []);
        for (const file of files.filter((name) => name.endsWith(".json"))) {
            const filePath = path.join(edgeRoot, file);
            const edge = JSON.parse(await fs.readFile(filePath, "utf8"));
            const actorId = typeof edge.authProfile === "string" && edge.authProfile ? edge.authProfile : "none";
            edge.actor = actorId === "none" ? { id: "none", label: "Anonymous", tokenSource: "none" } : {
                id: actorId,
                label: profiles[actorId]?.note ?? actorId,
                meaning: { description: profiles[actorId]?.note ?? actorId },
                tokenSource: "cache_hit",
            };
            delete edge.authProfile;
            await atomicText(filePath, `${JSON.stringify(edge, null, 2)}\n`);
        }
    }
}
//# sourceMappingURL=migrate.js.map