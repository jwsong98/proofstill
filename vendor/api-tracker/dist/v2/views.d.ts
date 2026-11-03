import type { ResolvedApp, TrackerView } from "./types.js";
export declare function buildTrackerView(app: ResolvedApp, kind: TrackerView["kind"], options?: {
    session?: string;
    scenario?: string;
    edgeId?: number;
    detailLevel?: "summary" | "full";
}): Promise<TrackerView>;
