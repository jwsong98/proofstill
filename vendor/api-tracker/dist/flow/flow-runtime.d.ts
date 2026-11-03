import type { Config, Ref } from "../types.js";
import type { ActionView, FlowCallConfig, FlowCallResult, FlowConfig, FlowSessionState, FlowStateRef, ManualFieldInfo, OpenApiOperation } from "./types.js";
/** Build the common envelope header for a state. */
export declare function stateRef(flow: FlowConfig, stateId: string): FlowStateRef;
/**
 * Describe a single action fully: its target state and every input the agent
 * must supply (observed candidates + typed manual fields). This is the unit the
 * agent contract is built from — `actions` returns a list of these, `inputs`
 * returns one.
 */
export declare function buildActionView(flow: FlowConfig, state: FlowSessionState, actionId: string, operations: Map<string, OpenApiOperation>): ActionView;
/** All actions available from the current state, each fully described. */
export declare function describeAvailableActions(flow: FlowConfig, state: FlowSessionState, operations: Map<string, OpenApiOperation>): ActionView[];
/**
 * Enrich an action's `manual` keys with type info from the OpenAPI schema.
 *
 * A manual key is matched by name against the body/param fields of the action's
 * calls (first match wins). Keys that don't directly map to a top-level schema
 * field — e.g. a `patch` key bound to an entire request body — degrade to an
 * untyped `{ name, required: true }` entry.
 */
export declare function describeManualFields(flow: FlowConfig, stateId: string, actionId: string, operations: Map<string, OpenApiOperation>): ManualFieldInfo[];
export declare function suggestProducerActions(flow: FlowConfig, stateId: string, observedAs: string): string[];
export declare function runFlowAction(options: {
    config: Config;
    flow: FlowConfig;
    session: string;
    actionId: string;
    inputs?: Record<string, string>;
    values?: Record<string, unknown>;
}): Promise<{
    action: string;
    from: string;
    to: string;
    calls: FlowCallResult[];
    loaded: FlowCallResult[];
    state: FlowSessionState;
}>;
/**
 * Run a screen's `load` calls and persist the resulting state. Used when a
 * session starts directly on a screen (flow start), where there is no
 * transitioning action to trigger the load. Returns the executed load calls and
 * the updated state; a no-op (empty `loaded`) when the screen defines no load.
 */
export declare function runScreenLoad(options: {
    config: Config;
    flow: FlowConfig;
    session: string;
}): Promise<{
    loaded: FlowCallResult[];
    state: FlowSessionState;
}>;
export declare function renderCall(operation: OpenApiOperation, call: FlowCallConfig, context: Record<string, unknown>): {
    path: string;
    headers: Record<string, string>;
    body: any;
    refs: Ref[];
};
