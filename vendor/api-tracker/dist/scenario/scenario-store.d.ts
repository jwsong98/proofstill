import type { Edge } from "../types.js";
import type { ScenarioConfig, ScenarioResult } from "./types.js";
/**
 * Resolve a scenario CLI argument to a tracker-root-relative path. A bare name
 * ("defect-inspect") maps to "scenarios/defect-inspect.yaml"; a path with a
 * slash or extension is used as-is (with ".yaml" appended when extensionless).
 */
export declare function resolveScenarioPath(arg: string): string;
export declare function loadScenario(path: string): Promise<ScenarioConfig>;
export declare function listScenarioPaths(): Promise<string[]>;
export declare function readScenarioResult(session: string): Promise<ScenarioResult | null>;
export declare function writeScenarioResult(session: string, result: ScenarioResult): Promise<void>;
/** The most recently finished scenario result across all sessions, if any. */
export declare function findLatestScenarioResult(): Promise<ScenarioResult | null>;
/** A scenario file joined with its most recent run result (null = never run). */
export interface ScenarioOverview {
    path: string;
    config: ScenarioConfig | null;
    result: ScenarioResult | null;
}
/**
 * List every scenario file joined with its latest run result. Used by
 * `scenario browse` to render the ticket board. A scenario whose YAML fails to
 * parse is still listed (config null) so it stays visible.
 */
export declare function listScenarioOverviews(): Promise<ScenarioOverview[]>;
/** Load a session's recorded edges (for the scenario browser's edge drill-in). */
export declare function loadSessionEdges(session: string): Promise<Edge[]>;
