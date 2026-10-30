import type { Config } from "../types.js";
export declare function resetDatabase(config: Config): Promise<{
    success: boolean;
    output: string;
}>;
