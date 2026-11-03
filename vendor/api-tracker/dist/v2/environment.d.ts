import type { AppResult, ResolvedApp, RuntimeState, SpecCompareResult } from "./types.js";
export declare function readRuntime(app: ResolvedApp): Promise<RuntimeState | null>;
export declare function startEnvironment(app: ResolvedApp): Promise<AppResult<RuntimeState>>;
export declare function resetEnvironment(app: ResolvedApp): Promise<AppResult>;
export declare function stopEnvironment(app: ResolvedApp, force?: boolean): Promise<AppResult>;
export declare function prepareEnvironment(app: ResolvedApp, options?: {
    reset?: boolean;
    generateSpec?: boolean;
}): Promise<AppResult<{
    runtime: RuntimeState;
    spec?: SpecCompareResult;
}>>;
