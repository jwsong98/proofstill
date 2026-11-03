import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
export class ConfigV2Error extends Error {
    code;
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "ConfigV2Error";
    }
}
export function trackerRootFor(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), ".api-tracker");
}
export async function readRawConfig(workspaceRoot) {
    const configPath = path.join(trackerRootFor(workspaceRoot), "config.yaml");
    let raw;
    try {
        raw = await fs.readFile(configPath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            throw new ConfigV2Error("CONFIG_NOT_FOUND", `API Tracker config not found at ${configPath}`);
        }
        throw error;
    }
    return YAML.parse(raw);
}
export async function loadConfigV2(workspaceRoot) {
    const raw = await readRawConfig(workspaceRoot);
    if (raw?.version !== 2) {
        throw new ConfigV2Error("CONFIG_MIGRATION_REQUIRED", "API Tracker v1 config requires explicit migration. Run 'api-tracker migrate --to 2 --dry-run' first.", { currentVersion: raw?.version ?? 1 });
    }
    if (typeof raw.defaultApp !== "string" || !raw.apps || typeof raw.apps !== "object") {
        throw new ConfigV2Error("CONFIG_INVALID", "config.yaml must define defaultApp and apps");
    }
    const config = raw;
    if (!config.apps[config.defaultApp]) {
        throw new ConfigV2Error("CONFIG_INVALID", `defaultApp "${config.defaultApp}" is not defined`);
    }
    return config;
}
function resolveWorkspacePath(workspaceRoot, value) {
    return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}
export async function resolveApp(workspaceRoot, appId) {
    const root = path.resolve(workspaceRoot);
    const config = await loadConfigV2(root);
    const selected = appId ?? config.defaultApp;
    const app = config.apps[selected];
    if (!app) {
        throw new ConfigV2Error("APP_NOT_FOUND", `App "${selected}" is not defined`, {
            available: Object.keys(config.apps),
        });
    }
    const trackerRoot = trackerRootFor(root);
    const appRoot = resolveWorkspacePath(root, app.root);
    return {
        workspaceRoot: root,
        trackerRoot,
        appId: selected,
        config,
        app,
        appRoot,
        adapterRoot: path.resolve(appRoot, app.adapterDir),
        contractPath: resolveWorkspacePath(root, app.specs.contract),
        generatedPath: resolveWorkspacePath(root, app.specs.generated),
        runtimeRoot: path.join(trackerRoot, "runtime", selected),
        sessionsRoot: path.join(trackerRoot, "sessions", selected),
    };
}
export function configDiagnostics(app) {
    const diagnostics = [];
    for (const [actorId, actor] of Object.entries(app.auth?.actors ?? {})) {
        for (const [key, value] of Object.entries(actor.credentials ?? {})) {
            if (typeof value === "string" && !/^\$\{env\.[A-Za-z_][A-Za-z0-9_]*\}$/.test(value)) {
                diagnostics.push({
                    code: "PLAINTEXT_CREDENTIAL_DEPRECATED",
                    severity: "warning",
                    message: `Actor "${actorId}" credential "${key}" is stored as plaintext`,
                });
            }
        }
    }
    return diagnostics;
}
export function resolveEnvValues(value) {
    if (typeof value === "string") {
        const match = value.match(/^\$\{env\.([A-Za-z_][A-Za-z0-9_]*)\}$/);
        if (!match)
            return value;
        const resolved = process.env[match[1]];
        if (resolved == null) {
            throw new ConfigV2Error("MISSING_ENV_CREDENTIAL", `Environment variable ${match[1]} is not set`);
        }
        return resolved;
    }
    if (Array.isArray(value))
        return value.map(resolveEnvValues);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveEnvValues(child)]));
    }
    return value;
}
//# sourceMappingURL=config.js.map