#!/usr/bin/env node
import { Command } from "commander";
import { sessionCommand } from "./commands/session.js";
import { authCommand } from "./commands/auth.js";
import { callCommand } from "./commands/call.js";
import { replayCommand } from "./commands/replay.js";
import { dbCommand } from "./commands/db.js";
import { flowCommand } from "./commands/flow.js";
import { scenarioCommand } from "./commands/scenario.js";
import { initCommand } from "./commands/init.js";
import { appCommand, envCommand, migrateCommand, specCommand, viewCommand } from "./commands/v2.js";
import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
const program = new Command()
    .name("api-tracker")
    .description("API 호출 기록 및 Replay CLI")
    .version("0.2.0")
    .option("--workspace-root <path>", "Workspace containing .api-tracker", process.cwd())
    .option("--app <id>", "Application id from config.yaml")
    .option("--human", "사람이 읽기 쉬운 출력 형식");
program.hook("preAction", async (_thisCommand, actionCommand) => {
    const globals = actionCommand.optsWithGlobals();
    const workspaceRoot = path.resolve(globals.workspaceRoot ?? process.cwd());
    process.env.API_TRACKER_ROOT = path.join(workspaceRoot, ".api-tracker");
    if (globals.app)
        process.env.API_TRACKER_APP = globals.app;
    if (["migrate", "init"].includes(actionCommand.name()))
        return;
    try {
        const raw = YAML.parse(await fs.readFile(path.join(workspaceRoot, ".api-tracker", "config.yaml"), "utf8"));
        if (raw?.version !== 2) {
            const error = new Error("API Tracker v1 config requires explicit migration. Run 'api-tracker migrate --to 2 --dry-run'.");
            error.exitCode = 2;
            error.code = "CONFIG_MIGRATION_REQUIRED";
            throw error;
        }
        process.env.API_TRACKER_APP = globals.app ?? raw.defaultApp;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    }
});
program.addCommand(sessionCommand());
program.addCommand(initCommand());
program.addCommand(migrateCommand());
program.addCommand(appCommand());
program.addCommand(envCommand());
program.addCommand(specCommand());
program.addCommand(viewCommand());
program.addCommand(authCommand());
program.addCommand(callCommand());
program.addCommand(replayCommand());
program.addCommand(dbCommand());
program.addCommand(flowCommand());
program.addCommand(scenarioCommand());
program.parseAsync(process.argv).catch((err) => {
    const failure = err;
    console.log(JSON.stringify({ ok: false, code: failure.code ?? "CLI_ERROR", error: { message: failure.message } }));
    process.exit(failure.exitCode ?? 2);
});
//# sourceMappingURL=index.js.map