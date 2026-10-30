import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);
const TIMEOUT_MS = 60_000;
export async function resetDatabase(config) {
    try {
        const { stdout, stderr } = await execAsync(config.db.resetCommand, {
            cwd: config.db.resetWorkingDir || undefined,
            timeout: TIMEOUT_MS,
        });
        const output = [stdout, stderr].filter(Boolean).join("\n");
        return { success: true, output };
    }
    catch (err) {
        const e = err;
        const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
        return { success: false, output };
    }
}
//# sourceMappingURL=db-resetter.js.map