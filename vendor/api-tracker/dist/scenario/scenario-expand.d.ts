import type { FlowConfig, OpenApiOperation } from "../flow/types.js";
import type { ScenarioConfig } from "./types.js";
/** One resolved API call behind a scenario step or goal. */
export interface ExpandedCall {
    /** "action" = the step's own flow calls; "load" = the destination screen's auto-load. */
    kind: "action" | "load" | "goal";
    operationId: string;
    method?: string;
    path?: string;
    auth?: string;
    /** True when the operationId is not present in the OpenAPI spec (new/unimplemented). */
    unresolved: boolean;
}
export interface ExpandedStep {
    action: string;
    from: string;
    to: string;
    /** False when the action is not reachable from `from` (walk broke). */
    reachable: boolean;
    calls: ExpandedCall[];
}
export interface ExpandedGoal {
    name: string;
    call: ExpandedCall;
}
export interface ExpandedScenario {
    steps: ExpandedStep[];
    goals: ExpandedGoal[];
}
/**
 * Statically expand a scenario into the API calls it walks — without running it.
 * Mirrors the flow runtime: each step fires its action's `calls`, transitions to
 * `action.to`, and (on a state change) the destination screen's `load` calls fire.
 * Goals are standalone calls. Unknown operationIds are kept and flagged
 * `unresolved` so brand-new endpoints still show up in the flow view (as RED).
 */
export declare function expandScenario(scenario: ScenarioConfig, flow: FlowConfig, operations: Map<string, OpenApiOperation>): ExpandedScenario;
