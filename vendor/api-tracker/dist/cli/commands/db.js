import { Command } from "commander";
import { loadConfig } from "../../storage/config-loader.js";
import { resetDatabase } from "../../core/db-resetter.js";
import { manageEnvironment } from "../../application/index.js";
import path from "node:path";
export function dbCommand() {
    const cmd = new Command("db").description("Database operations");
    cmd
        .command("reset")
        .description("Reset database to seed state")
        .action(async () => {
        try {
            const raw = await import("../../storage/file-store.js").then(({ readYaml }) => readYaml("config.yaml"));
            if (raw.version === 2) {
                const workspaceRoot = path.dirname(process.env.API_TRACKER_ROOT ?? path.join(process.cwd(), ".api-tracker"));
                console.log(JSON.stringify(await manageEnvironment({ workspaceRoot, appId: process.env.API_TRACKER_APP, action: "reset" }), null, 2));
                return;
            }
            const config = await loadConfig();
            const result = await resetDatabase(config);
            console.log(JSON.stringify(result, null, 2));
        }
        catch (err) {
            console.log(JSON.stringify({ error: err.message }));
        }
    });
    return cmd;
}
//# sourceMappingURL=db.js.map