import { readJson, writeJson, listDirs, exists, removeDir } from "../storage/file-store.js";
const SESSION_NAME_RE = /^[a-zA-Z0-9-]+$/;
function validateName(name) {
    if (!SESSION_NAME_RE.test(name)) {
        throw new Error(`Invalid session name "${name}": only alphanumeric characters and hyphens are allowed`);
    }
}
export async function createSession(options) {
    const { name, continueFrom } = options;
    validateName(name);
    if (await exists(`sessions/${name}/meta.json`)) {
        throw new Error(`Session "${name}" already exists`);
    }
    let seedLabel = "seed";
    let bindings = {};
    if (continueFrom) {
        const sourceMeta = await readJson(`sessions/${continueFrom}/meta.json`);
        if (!sourceMeta) {
            throw new Error(`Source session "${continueFrom}" not found`);
        }
        seedLabel = `continue:${continueFrom}`;
        const sourceBindings = await readJson(`sessions/${continueFrom}/bindings.json`);
        if (sourceBindings) {
            bindings = sourceBindings;
        }
    }
    const meta = {
        name,
        status: "active",
        createdAt: new Date().toISOString(),
        continueFrom: continueFrom ?? null,
        lastNodeId: 0,
        edgeCount: 0,
    };
    const graph = {
        nodes: [{ id: 0, label: seedLabel }],
        edges: [],
    };
    await writeJson(`sessions/${name}/meta.json`, meta);
    await writeJson(`sessions/${name}/graph.json`, graph);
    await writeJson(`sessions/${name}/bindings.json`, bindings);
    return meta;
}
/**
 * Wipe a session's directory and recreate it clean. Used by `scenario run` so
 * each attempt starts from a fresh flow-state/graph while keeping a stable
 * session identity (attempt count is carried in scenario-result.json).
 */
export async function resetSession(name) {
    validateName(name);
    await removeDir(`sessions/${name}`);
    return createSession({ name });
}
export async function listSessions() {
    const dirs = await listDirs("sessions");
    const results = [];
    for (const dir of dirs) {
        const meta = await readJson(`sessions/${dir}/meta.json`);
        if (meta) {
            results.push(meta);
        }
    }
    return results;
}
export async function getSession(name) {
    const meta = await readJson(`sessions/${name}/meta.json`);
    if (!meta) {
        throw new Error(`Session "${name}" not found`);
    }
    return meta;
}
export async function updateSessionMeta(name, updates) {
    const meta = await getSession(name);
    const updated = { ...meta, ...updates };
    await writeJson(`sessions/${name}/meta.json`, updated);
}
export async function getActiveSession() {
    const sessions = await listSessions();
    const active = sessions
        .filter((s) => s.status === "active")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return active.length > 0 ? active[0].name : null;
}
//# sourceMappingURL=session-manager.js.map