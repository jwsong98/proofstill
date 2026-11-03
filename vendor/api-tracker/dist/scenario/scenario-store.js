import { readJson, writeJson, listFiles, readYaml } from "../storage/file-store.js";
import { listSessions } from "../core/session-manager.js";
/**
 * Resolve a scenario CLI argument to a tracker-root-relative path. A bare name
 * ("defect-inspect") maps to "scenarios/defect-inspect.yaml"; a path with a
 * slash or extension is used as-is (with ".yaml" appended when extensionless).
 */
export function resolveScenarioPath(arg) {
    let p = arg;
    if (!/\.(ya?ml)$/i.test(p))
        p = `${p}.yaml`;
    if (!p.includes("/"))
        p = `scenarios/${p}`;
    return p;
}
export async function loadScenario(path) {
    return readYaml(path);
}
export async function listScenarioPaths() {
    const files = await listFiles("scenarios");
    return files.filter((f) => /\.(ya?ml)$/i.test(f)).map((f) => `scenarios/${f}`);
}
export async function readScenarioResult(session) {
    return readJson(`sessions/${session}/scenario-result.json`);
}
export async function writeScenarioResult(session, result) {
    await writeJson(`sessions/${session}/scenario-result.json`, result);
}
/** The most recently finished scenario result across all sessions, if any. */
export async function findLatestScenarioResult() {
    const sessions = await listSessions();
    let latest = null;
    for (const s of sessions) {
        const result = await readScenarioResult(s.name);
        if (!result)
            continue;
        if (!latest || result.finishedAt > latest.finishedAt)
            latest = result;
    }
    return latest;
}
/**
 * List every scenario file joined with its latest run result. Used by
 * `scenario browse` to render the ticket board. A scenario whose YAML fails to
 * parse is still listed (config null) so it stays visible.
 */
export async function listScenarioOverviews() {
    const paths = await listScenarioPaths();
    // Index the latest result per scenarioPath across all sessions.
    const sessions = await listSessions();
    const latestByPath = new Map();
    for (const s of sessions) {
        const result = await readScenarioResult(s.name);
        if (!result)
            continue;
        const current = latestByPath.get(result.scenarioPath);
        if (!current || result.finishedAt > current.finishedAt) {
            latestByPath.set(result.scenarioPath, result);
        }
    }
    const overviews = [];
    for (const path of paths) {
        let config = null;
        try {
            config = await loadScenario(path);
        }
        catch {
            config = null;
        }
        overviews.push({ path, config, result: latestByPath.get(path) ?? null });
    }
    return overviews;
}
/** Load a session's recorded edges (for the scenario browser's edge drill-in). */
export async function loadSessionEdges(session) {
    const files = await listFiles(`sessions/${session}/edges`);
    const edges = [];
    for (const file of files) {
        const edge = await readJson(`sessions/${session}/edges/${file}`);
        if (edge)
            edges.push(edge);
    }
    return edges.sort((a, b) => a.edgeId - b.edgeId);
}
//# sourceMappingURL=scenario-store.js.map