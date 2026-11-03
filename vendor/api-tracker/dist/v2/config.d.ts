import type { AppConfigV2, ConfigV2, Diagnostic, ResolvedApp } from "./types.js";
export declare class ConfigV2Error extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
export declare function trackerRootFor(workspaceRoot: string): string;
export declare function readRawConfig(workspaceRoot: string): Promise<unknown>;
export declare function loadConfigV2(workspaceRoot: string): Promise<ConfigV2>;
export declare function resolveApp(workspaceRoot: string, appId?: string): Promise<ResolvedApp>;
export declare function configDiagnostics(app: AppConfigV2): Diagnostic[];
export declare function resolveEnvValues(value: unknown): unknown;
