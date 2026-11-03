import type { AppResult, TrackerView } from "../v2/types.js";
export * from "../v2/types.js";
export declare function safeApplicationCall<T>(task: () => Promise<AppResult<T>>): Promise<AppResult<T>>;
export declare function inspectWorkspace(input: {
    workspaceRoot: string;
    appId?: string;
}): Promise<AppResult>;
export declare function migrateWorkspace(input: {
    workspaceRoot: string;
    apply?: boolean;
}): Promise<AppResult>;
export declare function manageEnvironment(input: {
    workspaceRoot: string;
    appId?: string;
    action: "status" | "start" | "reset" | "stop" | "prepare";
    reset?: boolean;
    generateSpec?: boolean;
    force?: boolean;
}): Promise<AppResult>;
export declare function inspectSpec(input: {
    workspaceRoot: string;
    appId?: string;
    action: "generate" | "validate" | "compare" | "operation";
    operationId?: string;
}): Promise<AppResult>;
export declare function manageActorAuth(input: {
    workspaceRoot: string;
    appId?: string;
    action: "status" | "resolve" | "forget";
    actorId?: string;
    force?: boolean;
}): Promise<AppResult>;
export declare function validateRequest(input: {
    workspaceRoot: string;
    appId?: string;
    operationId: string;
    params?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: unknown;
}): Promise<AppResult>;
export declare function getTrackerView(input: {
    workspaceRoot: string;
    appId?: string;
    kind: TrackerView["kind"];
    session?: string;
    scenario?: string;
    edgeId?: number;
    detailLevel?: "summary" | "full";
}): Promise<AppResult<TrackerView>>;
export declare function inspectFlow(input: {
    workspaceRoot: string;
    appId?: string;
    session?: string;
}): Promise<AppResult>;
export declare function runFlow(input: {
    workspaceRoot: string;
    appId?: string;
    session: string;
    action: string;
    inputs?: Record<string, string>;
    values?: Record<string, unknown>;
    startIfMissing?: boolean;
}): Promise<AppResult>;
export declare function inspectScenario(input: {
    workspaceRoot: string;
    appId?: string;
    scenario: string;
    session?: string;
}): Promise<AppResult>;
export declare function runScenarioUseCase(input: {
    workspaceRoot: string;
    appId?: string;
    scenario: string;
    session?: string;
    params?: Record<string, unknown>;
}): Promise<AppResult>;
export declare function replaySession(input: {
    workspaceRoot: string;
    appId?: string;
    session: string;
    targetNode: number;
}): Promise<AppResult>;
