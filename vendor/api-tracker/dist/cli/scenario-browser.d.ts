import type { Edge } from "../types.js";
import type { ScenarioOverview } from "../scenario/scenario-store.js";
import type { ScenarioConfig, ScenarioResult } from "../scenario/types.js";
import type { ExpandedScenario } from "../scenario/scenario-expand.js";
/** Resolve a scenario's static API-call expansion (null if flow/ops unavailable). */
export type ExpandFor = (config: ScenarioConfig) => ExpandedScenario | null;
/**
 * A human checklist of a completed run — the "cognitive-debt" view (design
 * §3.5). Shared with `scenario status/run --human` output.
 */
export declare function renderChecklist(r: ScenarioResult, expanded?: ExpandedScenario | null): string;
export declare function browseScenarios(overviews: ScenarioOverview[], loadEdges: (session: string) => Promise<Edge[]>, expandFor?: ExpandFor): Promise<void>;
