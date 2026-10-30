import { Command } from "commander";
import path from "node:path";
import { getTrackerView, inspectSpec, inspectWorkspace, manageActorAuth, manageEnvironment, migrateWorkspace, } from "../../application/index.js";
function context(command) {
    const globals = command.optsWithGlobals();
    return { workspaceRoot: path.resolve(globals.workspaceRoot ?? process.cwd()), appId: globals.app };
}
function emit(result) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok)
        process.exitCode = result.code === "SPEC_CONTRACT_DIFF" ? 1 : 2;
}
export function migrateCommand() {
    return new Command("migrate")
        .description("Explicitly migrate an API Tracker workspace")
        .requiredOption("--to <version>", "Target version; only 2 is supported")
        .option("--dry-run", "Show the migration without changing files")
        .option("--apply", "Apply the migration")
        .action(async (opts, command) => {
        if (opts.to !== "2") {
            emit({ ok: false, code: "MIGRATION_TARGET_UNSUPPORTED" });
            return;
        }
        emit(await migrateWorkspace({ workspaceRoot: context(command).workspaceRoot, apply: Boolean(opts.apply) }));
    });
}
export function appCommand() {
    const app = new Command("app").description("Inspect configured applications");
    app.command("doctor").description("Validate the fixed repository adapter scripts").action(async (_opts, command) => emit(await inspectWorkspace(context(command))));
    return app;
}
export function envCommand() {
    const env = new Command("env").description("Manage an application's server lifecycle");
    env.command("status").action(async (_opts, command) => emit(await manageEnvironment({ ...context(command), action: "status" })));
    env.command("start").action(async (_opts, command) => emit(await manageEnvironment({ ...context(command), action: "start" })));
    env.command("reset").action(async (_opts, command) => emit(await manageEnvironment({ ...context(command), action: "reset" })));
    env.command("stop").option("--force", "Allow the adapter to stop a non-owned runtime").action(async (opts, command) => emit(await manageEnvironment({ ...context(command), action: "stop", force: opts.force })));
    env.command("prepare")
        .option("--reset", "Reset application state before starting")
        .option("--generate-spec", "Generate and compare the server OpenAPI spec")
        .action(async (opts, command) => emit(await manageEnvironment({ ...context(command), action: "prepare", reset: opts.reset, generateSpec: opts.generateSpec })));
    return env;
}
export function specCommand() {
    const spec = new Command("spec").description("Generate, inspect, and compare OpenAPI contracts");
    spec.command("generate").action(async (_opts, command) => emit(await inspectSpec({ ...context(command), action: "generate" })));
    spec.command("validate").action(async (_opts, command) => emit(await inspectSpec({ ...context(command), action: "validate" })));
    spec.command("compare").action(async (_opts, command) => emit(await inspectSpec({ ...context(command), action: "compare" })));
    spec.command("operation").argument("<operationId>").action(async (operationId, _opts, command) => emit(await inspectSpec({ ...context(command), action: "operation", operationId })));
    return spec;
}
export function viewCommand() {
    return new Command("view")
        .description("Render the centralized API Tracker view model")
        .argument("<kind>", "overview|flow|session|scenario|diff|edge")
        .option("--session <name>")
        .option("--edge <id>")
        .option("--full")
        .action(async (kind, opts, command) => {
        if (!["overview", "flow", "session", "scenario", "diff", "edge"].includes(kind)) {
            emit({ ok: false, code: "VIEW_KIND_INVALID" });
            return;
        }
        emit(await getTrackerView({ ...context(command), kind: kind, session: opts.session, edgeId: opts.edge ? Number(opts.edge) : undefined, detailLevel: opts.full ? "full" : "summary" }));
    });
}
export async function emitActorCommand(command, action, actorId, force) {
    emit(await manageActorAuth({ ...context(command), action, actorId, force }));
}
//# sourceMappingURL=v2.js.map