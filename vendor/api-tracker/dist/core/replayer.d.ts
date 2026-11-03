import type { Config } from "../types.js";
export type ReplayResult = {
    status: "success" | "diverged";
    dbReset: boolean;
    targetNode: number;
    replayed: Array<{
        edgeId: number;
        originalStatus: number;
        actualStatus: number;
        match: boolean;
    }>;
    bindingUpdates: Record<string, {
        old: string;
        new: string;
    }>;
    divergedAt?: number;
    diff?: any;
};
export declare function replayToNode(options: {
    session: string;
    targetNode: number;
    config: Config;
}): Promise<ReplayResult>;
