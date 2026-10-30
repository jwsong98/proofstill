import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { getActiveAppId, getTrackerRoot, readJson, readYaml } from "./file-store.js";
export async function loadConfig() {
    const raw = await readYaml("config.yaml");
    if (raw.version !== 2)
        return raw;
    const v2 = raw;
    const appId = getActiveAppId() ?? v2.defaultApp;
    const app = v2.apps[appId];
    if (!app)
        throw new Error(`App "${appId}" is not defined in config.yaml`);
    const workspaceRoot = path.dirname(getTrackerRoot());
    const runtime = await readJson(`runtime/${appId}/runtime.json`);
    const contractPath = path.isAbsolute(app.specs.contract)
        ? app.specs.contract
        : path.resolve(workspaceRoot, app.specs.contract);
    const actorProfiles = {};
    let spec;
    for (const [actorId, actor] of Object.entries(app.auth?.actors ?? {})) {
        let endpoint = actor.login.endpoint;
        let method = actor.login.method ?? "POST";
        if (!endpoint && actor.login.operationId) {
            spec ??= await loadOpenApiDocument(contractPath);
            const found = findOperation(spec, actor.login.operationId);
            endpoint = found?.path;
            method = found?.method ?? method;
        }
        if (!endpoint)
            throw new Error(`Actor "${actorId}" login must define endpoint or a valid operationId`);
        actorProfiles[actorId] = {
            endpoint,
            method,
            credentials: actor.credentials ?? {},
            tokenPath: actor.login.tokenPath,
            note: actor.label,
        };
    }
    return {
        server: { baseUrl: runtime?.baseUrl ?? app.server?.baseUrl ?? "" },
        openapi: { specPath: contractPath },
        auth: { profiles: actorProfiles },
        db: { resetCommand: ":", resetWorkingDir: workspaceRoot },
    };
}
async function loadOpenApiDocument(filePath) {
    const text = await fs.readFile(filePath, "utf8");
    return (filePath.endsWith(".json") ? JSON.parse(text) : YAML.parse(text));
}
function findOperation(spec, operationId) {
    const paths = spec.paths;
    for (const [apiPath, item] of Object.entries(paths ?? {})) {
        if (!item || typeof item !== "object")
            continue;
        for (const [method, operation] of Object.entries(item)) {
            if (operation && typeof operation === "object" && operation.operationId === operationId) {
                return { path: apiPath, method: method.toUpperCase() };
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=config-loader.js.map