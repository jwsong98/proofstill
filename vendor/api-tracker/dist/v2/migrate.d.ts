import type { AppResult } from "./types.js";
export declare function migrateToV2(workspaceRoot: string, options?: {
    apply?: boolean;
}): Promise<AppResult>;
