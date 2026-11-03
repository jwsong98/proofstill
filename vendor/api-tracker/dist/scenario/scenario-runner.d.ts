import type { Config } from "../types.js";
import type { ScenarioConfig, ScenarioResult } from "./types.js";
/**
 * Run a scenario end to end: baseline setup → scripted step walk over the flow
 * state machine → goal assertions. Each `scenario run` resets its session for a
 * clean attempt; the attempt counter carries across runs via the prior result.
 * Returns the persisted result; overall is "green" only if setup, every step,
 * and every goal passed.
 */
export declare function runScenario(opts: {
    config: Config;
    scenario: ScenarioConfig;
    scenarioPath: string;
    session: string;
    params?: Record<string, unknown>;
}): Promise<ScenarioResult>;
