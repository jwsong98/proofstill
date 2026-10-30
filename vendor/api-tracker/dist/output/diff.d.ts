import type { EdgeResponse } from "../types.js";
export declare function diffResponses(original: EdgeResponse, actual: EdgeResponse): {
    match: boolean;
    diff: any;
};
export declare function formatDiff(original: EdgeResponse, actual: EdgeResponse, diffResult: any): string;
