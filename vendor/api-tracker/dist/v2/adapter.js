import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { redactSecretText } from "../core/redaction.js";
export const ADAPTER_NAMES = [
    "server-start",
    "server-stop",
    "server-reset",
    "server-health",
    "generate-openapi",
];
export async function doctorApp(app) {
    const scripts = await Promise.all(ADAPTER_NAMES.map(async (name) => {
        const scriptPath = path.join(app.adapterRoot, name);
        try {
            const stat = await fs.stat(scriptPath);
            return { name, path: scriptPath, exists: stat.isFile(), executable: (stat.mode & 0o111) !== 0 };
        }
        catch {
            return { name, path: scriptPath, exists: false, executable: false };
        }
    }));
    const invalid = scripts.filter((script) => !script.exists || !script.executable);
    return {
        ok: invalid.length === 0,
        code: invalid.length === 0 ? "APP_READY" : "ADAPTER_MISSING",
        data: { appId: app.appId, adapterRoot: app.adapterRoot, scripts },
        diagnostics: invalid.map((script) => ({
            code: script.exists ? "ADAPTER_NOT_EXECUTABLE" : "ADAPTER_MISSING",
            severity: "error",
            message: `${script.name} is ${script.exists ? "not executable" : "missing"}: ${script.path}`,
        })),
    };
}
export async function runAdapter(app, name, args = [], env = {}) {
    const scriptPath = path.join(app.adapterRoot, name);
    const timeoutMs = app.app.lifecycle?.timeoutMs ?? 60_000;
    await fs.access(scriptPath, fs.constants.X_OK).catch(() => {
        throw new Error(`Adapter ${name} is missing or not executable: ${scriptPath}`);
    });
    return new Promise((resolve, reject) => {
        const child = spawn(scriptPath, [...args, "--json", "--timeout-ms", String(timeoutMs)], {
            cwd: app.appRoot,
            env: {
                ...process.env,
                ...env,
                API_TRACKER_WORKSPACE_ROOT: app.workspaceRoot,
                API_TRACKER_APP_ID: app.appId,
            },
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timer = setTimeout(() => {
            child.kill("SIGTERM");
            settled = true;
            reject(new Error(`Adapter ${name} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.on("error", (error) => {
            clearTimeout(timer);
            if (!settled)
                reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (settled)
                return;
            let parsed;
            try {
                parsed = JSON.parse(stdout.trim());
            }
            catch {
                reject(new Error(`Adapter ${name} returned invalid JSON${stderr ? `: ${redactSecretText(stderr.trim())}` : ""}`));
                return;
            }
            if (code !== 0 || parsed.ok !== true) {
                reject(new Error(`Adapter ${name} failed with exit ${code}: ${redactSecretText(stderr.trim() || JSON.stringify(parsed))}`));
                return;
            }
            resolve(parsed);
        });
    });
}
export async function createAdapterScaffolds(appRoot, adapterDir) {
    const root = path.resolve(appRoot, adapterDir);
    await fs.mkdir(root, { recursive: true });
    const created = [];
    for (const name of ADAPTER_NAMES) {
        const filePath = path.join(root, name);
        try {
            await fs.access(filePath);
            continue;
        }
        catch {
            const script = `#!/usr/bin/env sh\nprintf '{"ok":false,"error":{"code":"ADAPTER_NOT_IMPLEMENTED","message":"Implement ${name} for this repository"}}\\n'\nexit 2\n`;
            await fs.writeFile(filePath, script, { encoding: "utf8", mode: 0o755 });
            created.push(filePath);
        }
    }
    return created;
}
//# sourceMappingURL=adapter.js.map