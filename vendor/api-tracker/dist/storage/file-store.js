import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { AsyncLocalStorage } from "node:async_hooks";
const storageContext = new AsyncLocalStorage();
export function withStorageContext(context, task) {
    return storageContext.run(context, task);
}
export function getActiveAppId() {
    return storageContext.getStore()?.appId ?? process.env.API_TRACKER_APP;
}
export function getTrackerRoot() {
    return storageContext.getStore()?.trackerRoot ?? process.env.API_TRACKER_ROOT ?? path.join(process.cwd(), ".api-tracker");
}
/**
 * A bare (non-nested) flow definition file, e.g. "flow.yaml", "flow-messenger.yaml",
 * or "signup-flow.yaml". These live per-app under apps/<appId>/ in the v2 layout.
 * The only other bare .yaml read at the tracker root is config.yaml (which stays
 * at the root); scenario paths carry a "scenarios/" prefix and are scoped elsewhere.
 */
function isFlowFile(relativePath) {
    return !relativePath.includes("/") && /\.ya?ml$/i.test(relativePath) && relativePath !== "config.yaml";
}
/**
 * Strip a directory prefix, accepting the bare directory itself.
 * `under("sessions/a/b", "sessions")` → `"a/b"`, `under("sessions", "sessions")` → `""`.
 * Returns null when the path is not in that directory.
 *
 * Callers reach these directories both ways: nested when addressing one entry
 * (`sessions/<name>/meta.json`) and bare when enumerating them (`listDirs("sessions")`).
 * Matching only the "sessions/" form left the bare enumeration unscoped, so it listed
 * the app directories themselves as if they were entries.
 */
function under(relativePath, dir) {
    if (relativePath === dir)
        return "";
    if (relativePath.startsWith(`${dir}/`))
        return relativePath.slice(dir.length + 1);
    return null;
}
function resolve(relativePath) {
    const appId = getActiveAppId();
    let scoped = relativePath;
    if (appId) {
        const sessionPath = under(relativePath, "sessions");
        const scenarioPath = under(relativePath, "scenarios");
        if (sessionPath !== null) {
            scoped = path.posix.join("sessions", appId, sessionPath);
        }
        else if (scenarioPath !== null) {
            scoped = path.posix.join("apps", appId, "scenarios", scenarioPath);
        }
        else if (isFlowFile(relativePath)) {
            scoped = `apps/${appId}/${relativePath}`;
        }
    }
    return path.join(getTrackerRoot(), scoped);
}
export async function readJson(relativePath) {
    const filePath = resolve(relativePath);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return null;
        }
        throw new Error(`Failed to read JSON at ${filePath}: ${err.message}`);
    }
}
export async function writeJson(relativePath, data) {
    const filePath = resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
export async function removeDir(relativePath) {
    await fs.rm(resolve(relativePath), { recursive: true, force: true });
}
export async function readYaml(relativePath) {
    const filePath = resolve(relativePath);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return YAML.parse(raw);
    }
    catch (err) {
        if (err.code === "ENOENT") {
            throw new Error(`YAML file not found: ${filePath}`);
        }
        throw new Error(`Failed to read YAML at ${filePath}: ${err.message}`);
    }
}
export async function writeYaml(relativePath, data) {
    const filePath = resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, YAML.stringify(data), "utf8");
    await fs.rename(temp, filePath);
}
export async function exists(relativePath) {
    try {
        await fs.access(resolve(relativePath));
        return true;
    }
    catch {
        return false;
    }
}
export async function listDirs(relativePath) {
    const dirPath = resolve(relativePath);
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return [];
        }
        throw new Error(`Failed to list directories at ${dirPath}: ${err.message}`);
    }
}
export async function listFiles(relativePath) {
    const dirPath = resolve(relativePath);
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .sort();
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return [];
        }
        throw new Error(`Failed to list files at ${dirPath}: ${err.message}`);
    }
}
//# sourceMappingURL=file-store.js.map