import { Command } from "commander";
import { readYaml, readJson } from "../../storage/file-store.js";
import { getSession, getActiveSession } from "../../core/session-manager.js";
import { resolveRequest, inferRefs } from "../../core/binding-engine.js";
import { detectUnreachable } from "../../detection/unreachable.js";
import { callWithAuth } from "../../core/http-caller.js";
import { recordEdge } from "../../core/recorder.js";
import { formatOutput } from "../../output/formatter.js";
import path from "node:path";
import { getActiveAppId, getTrackerRoot } from "../../storage/file-store.js";
import { resolveApp } from "../../v2/config.js";
import { findOperationByRoute, loadSpec, validateOperationRequest } from "../../v2/spec.js";
import { redactSecrets } from "../../core/redaction.js";
export function callCommand() {
    const cmd = new Command("call")
        .description("Make an API call and record it")
        .argument("<method>", "HTTP method")
        .argument("<path>", "API path")
        .option("--body <json>", "Request body (JSON string)")
        .option("--auth <profile>", "Auth profile name")
        .option("--actor <actor>", "Actor id")
        .option("--session <name>", "Session name")
        .option("--header <key:value>", "Additional header (repeatable)", collect, [])
        .option("--allow-invalid", "Call even when the request fails OpenAPI validation")
        .option("--allow-untracked", "Call a route not present in the contract")
        .option("--human", "Human-readable output")
        .action(async (method, path, opts) => {
        try {
            // 1. Load config
            const config = await readYaml("config.yaml");
            // 2. Resolve session
            const sessionName = opts.session ?? (await getActiveSession());
            if (!sessionName) {
                console.log(JSON.stringify({ error: "No active session. Run 'session start' first." }));
                return;
            }
            await getSession(sessionName); // validate existence
            // 3. Load bindings
            const bindings = (await readJson(`sessions/${sessionName}/bindings.json`)) ?? {};
            // 4. Parse body
            const body = opts.body ? JSON.parse(opts.body) : undefined;
            // 5. Resolve templates
            const templatePath = path;
            const templateBody = body;
            const { resolved, refs: explicitRefs } = resolveRequest({ path, body }, bindings);
            const rawConfig = await readYaml("config.yaml");
            let validationWarnings = [];
            if (rawConfig.version === 2) {
                const app = await resolveApp(pathModuleWorkspace(), getActiveAppId());
                const spec = await loadSpec(app.contractPath);
                const operation = findOperationByRoute(spec, method, resolved.path);
                if (!operation && !opts.allowUntracked)
                    throw new Error(`UNTRACKED_OPERATION: ${method.toUpperCase()} ${resolved.path}`);
                if (operation?.operationId) {
                    const issues = validateOperationRequest(spec, operation.operationId, {
                        params: routeParams(operation.path, resolved.path),
                        body: resolved.body,
                    });
                    if (issues.length > 0 && !opts.allowInvalid)
                        throw new Error(`OPENAPI_SCHEMA_INVALID: ${JSON.stringify(issues)}`);
                    if (issues.length > 0)
                        validationWarnings = ["OPENAPI_SCHEMA_INVALID_OVERRIDDEN"];
                }
                else if (!operation) {
                    validationWarnings = ["UNTRACKED_OPERATION_OVERRIDDEN"];
                }
            }
            // 6. Auto-infer refs
            const inferredRefs = inferRefs(resolved, bindings);
            const allRefs = [...explicitRefs, ...inferredRefs];
            // 7. Detect unreachable
            const warnings = [...detectUnreachable(allRefs), ...validationWarnings];
            // 8. Build URL and call
            const url = `${config.server.baseUrl}${resolved.path}`;
            const response = await callWithAuth({
                method,
                url,
                body: resolved.body,
                authProfile: opts.actor ?? opts.auth,
            });
            // 9. Record edge
            const { edgeId, fromNode, toNode, newBindings } = await recordEdge({
                session: sessionName,
                method,
                path: resolved.path,
                body: resolved.body,
                authProfile: opts.actor ?? opts.auth,
                templatePath,
                templateBody,
                refs: allRefs,
                response,
                warnings,
            });
            // 10. Output
            const output = {
                node: toNode,
                edge: edgeId,
                request: { method, path: resolved.path, body: redactSecrets(resolved.body) },
                response: { status: response.status, body: redactSecrets(response.body) },
                refs: allRefs,
                warnings,
                newBindings,
            };
            console.log(formatOutput(output, { human: opts.human }));
        }
        catch (err) {
            console.log(JSON.stringify({ error: err.message }));
        }
    });
    return cmd;
}
function pathModuleWorkspace() {
    return path.dirname(getTrackerRoot());
}
function routeParams(template, actual) {
    const names = [];
    const pattern = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{([^}]+)\\\}/g, (_match, name) => { names.push(name); return "([^/]+)"; });
    const match = actual.split("?")[0].match(new RegExp(`^${pattern}$`));
    return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match?.[index + 1] ?? "")]));
}
function collect(val, acc) {
    acc.push(val);
    return acc;
}
//# sourceMappingURL=call.js.map