import { Command } from "commander";
import { loadConfig } from "../../storage/config-loader.js";
import { formatOutput } from "../../output/formatter.js";
import { validateScenario, ScenarioError } from "../../scenario/scenario-loader.js";
import { runScenario } from "../../scenario/scenario-runner.js";
import { findLatestScenarioResult, listScenarioOverviews, loadScenario, loadSessionEdges, readScenarioResult, resolveScenarioPath, writeScenarioResult, } from "../../scenario/scenario-store.js";
import { browseScenarios, renderChecklist } from "../scenario-browser.js";
import { expandScenario } from "../../scenario/scenario-expand.js";
import { loadFlowConfig } from "../../flow/flow-loader.js";
import { loadOpenApiOperations } from "../../flow/openapi-index.js";
import { inspectSpec, manageEnvironment } from "../../application/index.js";
import path from "node:path";
import { exists, writeYaml } from "../../storage/file-store.js";
function sanitizeSession(ticket) {
    const name = ticket.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return name || "scenario";
}
function parseParams(values) {
    const result = {};
    for (const value of values) {
        const index = value.indexOf("=");
        if (index === -1)
            throw new Error(`Invalid --param "${value}": expected name=json`);
        const key = value.slice(0, index);
        const raw = value.slice(index + 1);
        try {
            result[key] = JSON.parse(raw);
        }
        catch {
            result[key] = raw;
        }
    }
    return result;
}
function collect(value, acc) {
    acc.push(value);
    return acc;
}
export function scenarioCommand() {
    const scenario = new Command("scenario")
        .description("Run a ticket scenario (executable spec) over the flow state machine")
        .addHelpText("after", `
Typical loop:
  $ api-tracker scenario validate defect-inspect
  $ api-tracker scenario run defect-inspect --human      # RED before implementing
  # ...implement...
  $ api-tracker scenario run defect-inspect --human      # GREEN when done

A scenario walks flow.yaml actions (steps) then asserts acceptance (goal).
Server-generated ids/timestamps: use \${saved.*} for late-binding, structural
matchers ({ isUuid: true }, { after: "\${run.startedAt}" }), or a baseline +
\${baseline.x + 1} offset. See docs/scenario-loop-design.md.
`);
    scenario
        .command("create")
        .description("Create a contract-first scenario scaffold with explicit environment preparation")
        .argument("<name>", "Scenario name or path under scenarios/")
        .option("--ticket <ticket>", "Goal/ticket identifier")
        .option("--title <title>", "Human-readable scenario title")
        .option("--force", "Overwrite an existing scaffold")
        .action(async (name, opts, command) => {
        const scenarioPath = resolveScenarioPath(name);
        const human = Boolean(command.optsWithGlobals().human);
        if (!opts.force && await exists(scenarioPath)) {
            console.log(formatOutput({ ok: false, code: "SCENARIO_ALREADY_EXISTS", error: { message: `Scenario already exists: ${scenarioPath}` } }, { human }));
            process.exitCode = 2;
            return;
        }
        const ticket = opts.ticket ?? path.basename(scenarioPath).replace(/\.ya?ml$/i, "");
        const scaffold = {
            version: 1,
            ticket,
            title: opts.title ?? ticket,
            environment: {
                prepare: true,
                reset: true,
                ensureServer: true,
                generateSpec: true,
                requireSpecMatchForGreen: true,
                stopAfter: false,
            },
            steps: [],
            goal: [],
        };
        await writeYaml(scenarioPath, scaffold);
        console.log(formatOutput({ ok: true, code: "SCENARIO_SCAFFOLDED", data: { path: scenarioPath, ticket } }, { human }));
    });
    scenario
        .command("validate")
        .description("Validate a scenario against its flow and OpenAPI spec (no HTTP)")
        .argument("<file>", "Scenario name or path under scenarios/")
        .option("--human", "Human-readable output")
        .action(async (file, _opts, command) => {
        const human = Boolean(command.optsWithGlobals().human);
        await emit({ human }, async () => {
            const config = await loadConfig();
            const scenarioConfig = await loadScenario(resolveScenarioPath(file));
            await validateScenario(scenarioConfig, config);
            return { ok: true, ticket: scenarioConfig.ticket };
        });
    });
    scenario
        .command("run")
        .description("Run a scenario: baseline → steps → goal. Exit code 1 when RED.")
        .argument("<file>", "Scenario name or path under scenarios/")
        .option("--session <name>", "Session name (default: derived from ticket)")
        .option("--param <name=json>", "Scenario param, read as ${params.name} (repeatable)", collect, [])
        .option("--human", "Human-readable checklist output")
        .action(async (file, opts, command) => {
        const human = Boolean(command.optsWithGlobals().human);
        const scenarioPath = resolveScenarioPath(file);
        const globals = command.optsWithGlobals();
        const workspaceRoot = path.resolve(globals.workspaceRoot ?? process.cwd());
        let preparedApp;
        try {
            const scenarioConfig = await loadScenario(scenarioPath);
            preparedApp = scenarioConfig.app ?? globals.app;
            if (preparedApp)
                process.env.API_TRACKER_APP = preparedApp;
            if (scenarioConfig.environment?.prepare) {
                const prepared = await manageEnvironment({
                    workspaceRoot,
                    appId: preparedApp,
                    action: "prepare",
                    reset: scenarioConfig.environment.reset,
                    generateSpec: scenarioConfig.environment.generateSpec,
                });
                if (!prepared.ok && prepared.code !== "ENVIRONMENT_READY_WITH_SPEC_DIFF") {
                    console.log(formatOutput(prepared, { human }));
                    process.exitCode = 2;
                    return;
                }
            }
            const config = await loadConfig();
            await validateScenario(scenarioConfig, config);
            const session = opts.session ?? sanitizeSession(scenarioConfig.ticket);
            const result = await runScenario({
                config,
                scenario: scenarioConfig,
                scenarioPath,
                session,
                params: parseParams(opts.param),
            });
            if (scenarioConfig.environment?.generateSpec || scenarioConfig.environment?.requireSpecMatchForGreen) {
                const compared = await inspectSpec({ workspaceRoot, appId: preparedApp, action: "compare" });
                const comparison = compared.data;
                result.specComparison = {
                    required: Boolean(scenarioConfig.environment.requireSpecMatchForGreen),
                    status: comparison?.status ?? compared.code,
                    summary: comparison?.summary,
                };
                if (result.specComparison.required && result.specComparison.status !== "match")
                    result.overall = "red";
                await writeScenarioResult(session, result);
            }
            console.log(human ? renderChecklist(result) : formatOutput(result));
            if (result.overall === "red")
                process.exitCode = 1;
        }
        catch (err) {
            emitError(err, human);
            process.exitCode = 2;
        }
        finally {
            try {
                const scenarioConfig = await loadScenario(scenarioPath);
                if (scenarioConfig.environment?.stopAfter) {
                    await manageEnvironment({ workspaceRoot, appId: preparedApp, action: "stop" });
                }
            }
            catch { /* preserve the primary scenario result */ }
        }
    });
    scenario
        .command("status")
        .description("Show the latest scenario result")
        .option("--session <name>", "Session name (default: most recent run)")
        .option("--human", "Human-readable checklist output")
        .action(async (opts, command) => {
        const human = Boolean(command.optsWithGlobals().human);
        const result = opts.session
            ? await readScenarioResult(opts.session)
            : await findLatestScenarioResult();
        if (!result) {
            console.log(formatOutput({ ok: false, error: { message: "No scenario result found. Run 'scenario run' first." } }));
            process.exitCode = 1;
            return;
        }
        console.log(human ? renderChecklist(result) : formatOutput(result));
        if (result.overall === "red")
            process.exitCode = 1;
    });
    scenario
        .command("browse")
        .description("Interactive scenario board → checklist → recorded edges")
        .action(async () => {
        const overviews = await listScenarioOverviews();
        // Preload the OpenAPI ops + every referenced flow once, so the detail view
        // can statically expand each step/goal into its API calls without a run.
        const config = await loadConfig();
        let operations = null;
        try {
            operations = await loadOpenApiOperations(config.openapi.specPath);
        }
        catch {
            operations = null;
        }
        const flowCache = new Map();
        const getFlow = async (flowPath) => {
            if (!flowCache.has(flowPath)) {
                try {
                    flowCache.set(flowPath, await loadFlowConfig(flowPath));
                }
                catch {
                    flowCache.set(flowPath, null);
                }
            }
            return flowCache.get(flowPath) ?? null;
        };
        for (const o of overviews) {
            if (o.config)
                await getFlow(o.config.flow ?? "flow.yaml");
        }
        const expandFor = (scenario) => {
            const flow = flowCache.get(scenario.flow ?? "flow.yaml");
            if (!flow || !operations)
                return null;
            return expandScenario(scenario, flow, operations);
        };
        await browseScenarios(overviews, loadSessionEdges, expandFor);
    });
    return scenario;
}
async function emit(opts, build) {
    try {
        console.log(formatOutput(await build(), { human: opts.human }));
    }
    catch (err) {
        emitError(err, opts.human);
        process.exitCode = 1;
    }
}
function emitError(err, human) {
    const error = err instanceof ScenarioError
        ? { message: err.message, ...err.details }
        : { message: err.message };
    console.log(formatOutput({ ok: false, error }, { human }));
}
//# sourceMappingURL=scenario.js.map