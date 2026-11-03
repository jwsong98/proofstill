import { resolveApp, configDiagnostics, ConfigV2Error } from "../v2/config.js";
import { doctorApp } from "../v2/adapter.js";
import { actorAuthStatus, forgetActorAuth, resolveActorAuth } from "../v2/auth.js";
import { compareSpecs, generateSpec, loadSpec, validateOperationRequest } from "../v2/spec.js";
import { prepareEnvironment, readRuntime, resetEnvironment, startEnvironment, stopEnvironment } from "../v2/environment.js";
import { migrateToV2 } from "../v2/migrate.js";
import { buildTrackerView } from "../v2/views.js";
import { withStorageContext } from "../storage/file-store.js";
import { loadConfig } from "../storage/config-loader.js";
import { loadFlowConfig } from "../flow/flow-loader.js";
import { getFlowSessionState, createFlowSessionState } from "../flow/flow-session-store.js";
import { describeAvailableActions, runFlowAction, runScreenLoad, stateRef } from "../flow/flow-runtime.js";
import { loadOpenApiOperations } from "../flow/openapi-index.js";
import { createSession, getSession } from "../core/session-manager.js";
import { loadScenario, resolveScenarioPath, writeScenarioResult } from "../scenario/scenario-store.js";
import { validateScenario } from "../scenario/scenario-loader.js";
import { runScenario } from "../scenario/scenario-runner.js";
import { replayToNode } from "../core/replayer.js";
export * from "../v2/types.js";
export async function safeApplicationCall(task) {
    try {
        return await task();
    }
    catch (error) {
        const code = error instanceof ConfigV2Error ? error.code : "APPLICATION_ERROR";
        return { ok: false, code, error: { message: error.message, details: error instanceof ConfigV2Error ? error.details : undefined } };
    }
}
export async function inspectWorkspace(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        const doctor = await doctorApp(app);
        const runtime = await readRuntime(app);
        return {
            ok: true,
            code: "WORKSPACE_INSPECTED",
            data: {
                version: "0.2.0",
                appId: app.appId,
                workspaceRoot: app.workspaceRoot,
                contractPath: app.contractPath,
                generatedPath: app.generatedPath,
                runtime: runtime ? { running: true, baseUrl: runtime.baseUrl, startedAt: runtime.startedAt } : { running: false },
                adapter: doctor.data,
            },
            diagnostics: [...configDiagnostics(app.app), ...(doctor.diagnostics ?? [])],
        };
    });
}
export async function migrateWorkspace(input) {
    return safeApplicationCall(() => migrateToV2(input.workspaceRoot, { apply: input.apply }));
}
export async function manageEnvironment(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        if (input.action === "status")
            return { ok: true, code: "ENVIRONMENT_STATUS", data: await readRuntime(app) };
        if (input.action === "start")
            return startEnvironment(app);
        if (input.action === "reset")
            return resetEnvironment(app);
        if (input.action === "stop")
            return stopEnvironment(app, input.force);
        return prepareEnvironment(app, { reset: input.reset, generateSpec: input.generateSpec });
    });
}
export async function inspectSpec(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        if (input.action === "generate")
            return { ok: true, code: "SPEC_GENERATED", data: { path: await generateSpec(app, (await readRuntime(app))?.baseUrl) } };
        if (input.action === "compare") {
            const result = await compareSpecs(app);
            return { ok: result.status === "match", code: result.status === "match" ? "SPEC_MATCH" : "SPEC_CONTRACT_DIFF", data: result };
        }
        const spec = await loadSpec(app.contractPath);
        if (input.action === "validate")
            return { ok: true, code: "SPEC_VALID", data: { path: app.contractPath, pathCount: Object.keys(spec.paths).length } };
        if (!input.operationId)
            return { ok: false, code: "OPERATION_ID_REQUIRED", error: { message: "operation action requires operationId" } };
        for (const [apiPath, item] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(item)) {
                if (operation && typeof operation === "object" && operation.operationId === input.operationId)
                    return { ok: true, code: "OPERATION_FOUND", data: { operationId: input.operationId, method: method.toUpperCase(), path: apiPath, operation } };
            }
        }
        return { ok: false, code: "UNKNOWN_OPERATION", error: { message: `Unknown operationId "${input.operationId}"` } };
    });
}
export async function manageActorAuth(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        if (input.action === "status")
            return actorAuthStatus(app);
        if (!input.actorId)
            return { ok: false, code: "ACTOR_ID_REQUIRED", error: { message: `${input.action} requires actorId` } };
        if (input.action === "forget")
            return forgetActorAuth(app, input.actorId);
        const auth = await resolveActorAuth(app, input.actorId, input.force);
        return { ok: true, code: auth.evidence.tokenSource === "cache_hit" ? "AUTH_CACHE_HIT" : "AUTH_RESOLVED", data: { actor: auth.evidence } };
    });
}
export async function validateRequest(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        const issues = validateOperationRequest(await loadSpec(app.contractPath), input.operationId, input);
        return issues.length === 0 ? { ok: true, code: "OPENAPI_REQUEST_VALID" } : { ok: false, code: "OPENAPI_SCHEMA_INVALID", error: { message: `Request does not match ${input.operationId}`, details: { issues } } };
    });
}
export async function getTrackerView(input) {
    return safeApplicationCall(async () => {
        const app = await resolveApp(input.workspaceRoot, input.appId);
        return { ok: true, code: "TRACKER_VIEW", data: await buildTrackerView(app, input.kind, input) };
    });
}
async function withResolvedStorage(workspaceRoot, appId, task) {
    const app = await resolveApp(workspaceRoot, appId);
    return withStorageContext({ trackerRoot: app.trackerRoot, appId: app.appId }, () => task(app));
}
export async function inspectFlow(input) {
    return safeApplicationCall(() => withResolvedStorage(input.workspaceRoot, input.appId, async (app) => {
        const flow = await loadFlowConfig();
        if (!input.session) {
            return { ok: true, code: "FLOW_INSPECTED", data: { appId: app.appId, initialState: flow.initialState, defaultActor: flow.defaultActor, states: flow.states } };
        }
        const config = await loadConfig();
        const state = await getFlowSessionState(input.session);
        const operations = await loadOpenApiOperations(config.openapi.specPath);
        return { ok: true, code: "FLOW_ACTIONS", data: { state: stateRef(flow, state.currentState), actions: describeAvailableActions(flow, state, operations) } };
    }));
}
export async function runFlow(input) {
    return safeApplicationCall(() => withResolvedStorage(input.workspaceRoot, input.appId, async (app) => {
        const config = await loadConfig();
        const flow = await loadFlowConfig();
        try {
            await getSession(input.session);
        }
        catch {
            if (!input.startIfMissing)
                throw new Error(`Session "${input.session}" not found`);
            await createSession({ name: input.session });
            await createFlowSessionState(input.session, flow);
            await runScreenLoad({ config, flow, session: input.session });
        }
        const result = await runFlowAction({ config, flow, session: input.session, actionId: input.action, inputs: input.inputs, values: input.values });
        return { ok: true, code: "FLOW_ACTION_EXECUTED", data: { appId: app.appId, action: result.action, from: result.from, to: result.to, calls: result.calls, loaded: result.loaded } };
    }));
}
export async function inspectScenario(input) {
    return safeApplicationCall(() => withResolvedStorage(input.workspaceRoot, input.appId, async () => {
        const config = await loadConfig();
        const scenarioPath = resolveScenarioPath(input.scenario);
        const scenario = await loadScenario(scenarioPath);
        await validateScenario(scenario, config);
        return { ok: true, code: "SCENARIO_VALID", data: { path: scenarioPath, ticket: scenario.ticket, title: scenario.title, environment: scenario.environment, steps: scenario.steps, goal: scenario.goal, session: input.session } };
    }));
}
export async function runScenarioUseCase(input) {
    return safeApplicationCall(() => withResolvedStorage(input.workspaceRoot, input.appId, async (app) => {
        const scenarioPath = resolveScenarioPath(input.scenario);
        const scenario = await loadScenario(scenarioPath);
        if (scenario.environment?.prepare) {
            const prepared = await prepareEnvironment(app, { reset: scenario.environment.reset, generateSpec: scenario.environment.generateSpec });
            if (!prepared.ok)
                return prepared;
        }
        try {
            const config = await loadConfig();
            await validateScenario(scenario, config);
            const session = input.session ?? (scenario.ticket.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "scenario");
            const result = await runScenario({ config, scenario, scenarioPath, session, params: input.params });
            if (scenario.environment?.generateSpec || scenario.environment?.requireSpecMatchForGreen) {
                const comparison = await compareSpecs(app);
                result.specComparison = { required: Boolean(scenario.environment.requireSpecMatchForGreen), status: comparison.status, summary: comparison.summary };
                if (result.specComparison.required && comparison.status !== "match")
                    result.overall = "red";
                await writeScenarioResult(session, result);
            }
            return { ok: result.overall === "green", code: result.overall === "green" ? "SCENARIO_GREEN" : "SCENARIO_RED", data: result };
        }
        finally {
            if (scenario.environment?.stopAfter)
                await stopEnvironment(app);
        }
    }));
}
export async function replaySession(input) {
    return safeApplicationCall(() => withResolvedStorage(input.workspaceRoot, input.appId, async (app) => {
        await resetEnvironment(app);
        await startEnvironment(app);
        const config = await loadConfig();
        const result = await replayToNode({ session: input.session, targetNode: input.targetNode, config });
        return { ok: result.status === "success", code: result.status === "success" ? "REPLAY_COMPLETE" : "REPLAY_DIVERGED", data: result };
    }));
}
//# sourceMappingURL=index.js.map