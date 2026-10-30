import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { actorAuthStatus } from "./auth.js";
import { readRuntime } from "./environment.js";
async function readJson(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return null;
        throw error;
    }
}
function sanitize(value) {
    if (Array.isArray(value))
        return value.map(sanitize);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
        key,
        /authorization|token|password|secret|credential/i.test(key) && key !== "tokenSource" && key !== "tokenFingerprint" ? "***" : sanitize(child),
    ]));
}
export async function buildTrackerView(app, kind, options = {}) {
    const diagnostics = [];
    let summary = {};
    let items = [];
    const links = [];
    if (kind === "overview") {
        const runtime = await readRuntime(app);
        const auth = await actorAuthStatus(app);
        const sessions = await fs.readdir(app.sessionsRoot, { withFileTypes: true }).catch(() => []);
        const compare = await readJson(path.join(app.runtimeRoot, "spec-compare.json"));
        summary = { runtime: runtime ? { running: true, baseUrl: runtime.baseUrl, startedAt: runtime.startedAt } : { running: false }, spec: compare, auth: auth.data };
        items = sessions.filter((entry) => entry.isDirectory()).map((entry) => ({ session: entry.name }));
    }
    else if (kind === "flow") {
        const flowPath = app.app.flow ? path.resolve(app.workspaceRoot, app.app.flow) : path.join(app.trackerRoot, "apps", app.appId, "flow.yaml");
        const flow = YAML.parse(await fs.readFile(flowPath, "utf8"));
        summary = { initialState: flow.initialState, defaultActor: flow.defaultActor };
        items = Object.entries(flow.states ?? {}).map(([id, state]) => ({ id, ...state }));
    }
    else if (kind === "diff") {
        const compare = await readJson(path.join(app.runtimeRoot, "spec-compare.json"));
        summary = compare ?? { status: "not_run" };
        items = compare?.changes ?? [];
    }
    else {
        if (!options.session)
            throw new Error(`${kind} view requires session`);
        const sessionRoot = path.join(app.sessionsRoot, options.session);
        if (kind === "session") {
            const meta = await readJson(path.join(sessionRoot, "meta.json"));
            const graph = await readJson(path.join(sessionRoot, "graph.json"));
            summary = meta ?? {};
            items = graph?.edges ?? [];
        }
        else if (kind === "scenario") {
            const result = await readJson(path.join(sessionRoot, "scenario-result.json"));
            summary = result ? { ticket: result.ticket, overall: result.overall, attempt: result.attempt } : { status: "not_run" };
            items = result ? [...(result.baseline ?? []), ...(result.steps ?? []), ...(result.goal ?? [])] : [];
        }
        else if (kind === "edge") {
            if (options.edgeId == null)
                throw new Error("edge view requires edgeId");
            const edge = await readJson(path.join(sessionRoot, "edges", `${String(options.edgeId).padStart(3, "0")}.json`));
            summary = { edgeId: options.edgeId };
            items = edge ? [edge] : [];
        }
        links.push({ rel: "session", target: options.session });
    }
    return {
        version: 1,
        kind,
        subject: { app: app.appId, session: options.session, scenario: options.scenario, edgeId: options.edgeId },
        summary: sanitize(summary),
        items: sanitize(options.detailLevel === "full" ? items : items.slice(0, 50)),
        links,
        diagnostics,
    };
}
//# sourceMappingURL=views.js.map