import type { Config } from "../types.js";
import type { ScenarioConfig } from "./types.js";
export declare class ScenarioError extends Error {
    readonly details: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Dry-check the scenario against its flow and OpenAPI spec without any HTTP:
 * every step's action must be reachable by walking the state machine from the
 * initial state, its observed inputs must match the action's `requires`, and all
 * baseline/goal operationIds must exist in the spec.
 */
export declare function validateScenario(scenario: ScenarioConfig, config: Config): Promise<void>;
