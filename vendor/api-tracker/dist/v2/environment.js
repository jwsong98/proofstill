import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { doctorApp, runAdapter } from "./adapter.js";
import { compareSpecs, generateSpec } from "./spec.js";
const RUNTIME_FILE = "runtime.json";
async function atomicJson(filePath, value, mode) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
    if (mode != null)
        await fs.chmod(temp, mode);
    await fs.rename(temp, filePath);
}
async function withAppLock(app, task) {
    await fs.mkdir(app.runtimeRoot, { recursive: true });
    const lockPath = path.join(app.runtimeRoot, "lock");
    const timeoutMs = app.app.lifecycle?.timeoutMs ?? 60_000;
    const started = Date.now();
    let handle;
    while (!handle) {
        try {
            handle = await fs.open(lockPath, "wx", 0o600);
            await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
            if (Date.now() - started >= timeoutMs)
                throw new Error(`Environment lock timed out: ${lockPath}`);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    try {
        return await task();
    }
    finally {
        await handle.close();
        await fs.unlink(lockPath).catch(() => undefined);
    }
}
export async function readRuntime(app) {
    try {
        return JSON.parse(await fs.readFile(path.join(app.runtimeRoot, RUNTIME_FILE), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return null;
        throw error;
    }
}
export async function startEnvironment(app) {
    return withAppLock(app, async () => {
        const existing = await readRuntime(app);
        if (existing) {
            try {
                const health = await runAdapter(app, "server-health", [], { API_TRACKER_BASE_URL: existing.baseUrl });
                if (health.ready === true)
                    return { ok: true, code: "SERVER_ALREADY_RUNNING", data: existing };
            }
            catch { /* stale runtime; start again */ }
        }
        const result = await runAdapter(app, "server-start", ["--port", "auto"]);
        const baseUrl = String(result.baseUrl ?? app.app.server?.baseUrl ?? "");
        if (!baseUrl)
            throw new Error("server-start must return baseUrl or app.server.baseUrl must be configured");
        const state = {
            runId: crypto.randomUUID(),
            appId: app.appId,
            pid: typeof result.pid === "number" ? result.pid : undefined,
            baseUrl,
            logPath: typeof result.logPath === "string" ? result.logPath : undefined,
            startedAt: new Date().toISOString(),
            managedByTracker: true,
        };
        const health = await runAdapter(app, "server-health", [], { API_TRACKER_BASE_URL: baseUrl });
        if (health.ready !== true)
            throw new Error(`Server health adapter did not report ready=true for ${baseUrl}`);
        await atomicJson(path.join(app.runtimeRoot, RUNTIME_FILE), state, 0o600);
        return { ok: true, code: "SERVER_STARTED", data: state };
    });
}
export async function resetEnvironment(app) {
    return withAppLock(app, async () => {
        await runAdapter(app, "server-reset");
        await fs.unlink(path.join(app.runtimeRoot, RUNTIME_FILE)).catch(() => undefined);
        if (app.app.lifecycle?.invalidateAuthOnReset) {
            await fs.rm(path.join(app.runtimeRoot, "auth"), { recursive: true, force: true });
        }
        return { ok: true, code: "ENVIRONMENT_RESET", data: { appId: app.appId } };
    });
}
export async function stopEnvironment(app, force = false) {
    return withAppLock(app, async () => {
        const runtime = await readRuntime(app);
        if (!runtime)
            return { ok: true, code: "SERVER_ALREADY_STOPPED", data: { appId: app.appId } };
        if (!runtime.managedByTracker && !force) {
            return { ok: false, code: "SERVER_NOT_TRACKER_OWNED", error: { message: "Refusing to stop an externally managed server" } };
        }
        await runAdapter(app, "server-stop", ["--run-id", runtime.runId, ...(runtime.pid ? ["--pid", String(runtime.pid)] : [])]);
        await fs.unlink(path.join(app.runtimeRoot, RUNTIME_FILE)).catch(() => undefined);
        return { ok: true, code: "SERVER_STOPPED", data: { appId: app.appId, runId: runtime.runId } };
    });
}
export async function prepareEnvironment(app, options = {}) {
    const doctor = await doctorApp(app);
    if (!doctor.ok)
        return { ok: false, code: doctor.code, data: undefined, diagnostics: doctor.diagnostics, error: { message: "App adapter doctor failed" } };
    if (options.reset)
        await resetEnvironment(app);
    const started = await startEnvironment(app);
    if (!started.ok || !started.data)
        return { ok: false, code: started.code, diagnostics: started.diagnostics, error: started.error ?? { message: "Server failed to start" } };
    let spec;
    if (options.generateSpec) {
        await generateSpec(app, started.data.baseUrl);
        spec = await compareSpecs(app);
    }
    return {
        ok: true,
        code: spec && spec.status !== "match" ? "ENVIRONMENT_READY_WITH_SPEC_DIFF" : "ENVIRONMENT_READY",
        data: { runtime: started.data, spec },
    };
}
//# sourceMappingURL=environment.js.map