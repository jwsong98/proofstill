export type DiagnosticSeverity = "info" | "warning" | "error";
export interface Diagnostic {
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    details?: Record<string, unknown>;
}
export interface AppResult<T = unknown> {
    ok: boolean;
    code: string;
    data?: T;
    diagnostics?: Diagnostic[];
    error?: {
        message: string;
        details?: Record<string, unknown>;
    };
    artifacts?: Array<{
        kind: string;
        path: string;
    }>;
}
export interface ActorMeaning {
    role?: string;
    tenant?: string;
    description?: string;
    [key: string]: unknown;
}
export interface ActorConfig {
    label: string;
    meaning?: ActorMeaning;
    credentials?: Record<string, unknown>;
    login: {
        operationId?: string;
        endpoint?: string;
        method?: string;
        tokenPath: string;
        expiresAtPath?: string;
    };
    cache?: {
        scope?: "app" | "origin";
        maxAgeSeconds?: number;
        expirySkewSeconds?: number;
    };
    verify?: {
        expectedClaims?: Record<string, unknown>;
    };
}
export interface AppConfigV2 {
    root: string;
    adapterDir: string;
    specs: {
        contract: string;
        generated: string;
        ignorePointers?: string[];
    };
    /** Default flow definition (used when no --flow is given). */
    flow?: string;
    /** Additional named flow definitions, keyed by name (e.g. "signup-flow"). */
    flows?: Record<string, string>;
    server?: {
        baseUrl?: string;
    };
    lifecycle?: {
        timeoutMs?: number;
        invalidateAuthOnReset?: boolean;
    };
    auth?: {
        defaultActor?: string;
        actors?: Record<string, ActorConfig>;
    };
}
export interface ConfigV2 {
    version: 2;
    defaultApp: string;
    apps: Record<string, AppConfigV2>;
}
export interface ResolvedApp {
    workspaceRoot: string;
    trackerRoot: string;
    appId: string;
    config: ConfigV2;
    app: AppConfigV2;
    appRoot: string;
    adapterRoot: string;
    contractPath: string;
    generatedPath: string;
    runtimeRoot: string;
    sessionsRoot: string;
}
export interface RuntimeState {
    runId: string;
    appId: string;
    pid?: number;
    baseUrl: string;
    logPath?: string;
    startedAt: string;
    managedByTracker: boolean;
}
export interface ActorEvidence {
    id: string;
    label: string;
    meaning?: ActorMeaning;
    tokenSource: "none" | "cache_hit" | "login" | "retry";
    tokenFingerprint?: string;
}
export interface AuthCacheEntry {
    actorId: string;
    token: string;
    tokenFingerprint: string;
    obtainedAt: string;
    expiresAt: string;
    scopeKey: string;
}
export interface SpecChange {
    kind: string;
    severity: "info" | "warning" | "error";
    operationId?: string;
    method?: string;
    path?: string;
    pointer?: string;
    expected?: unknown;
    actual?: unknown;
}
export type SpecCompareStatus = "match" | "contract_ahead" | "implementation_ahead" | "incompatible" | "generation_failed";
export interface SpecCompareResult {
    status: SpecCompareStatus;
    summary: {
        contractOnly: number;
        generatedOnly: number;
        incompatible: number;
    };
    changes: SpecChange[];
    contractFingerprint: string;
    generatedFingerprint: string;
}
export interface ScenarioEnvironmentPolicy {
    prepare?: boolean;
    reset?: boolean;
    ensureServer?: boolean;
    generateSpec?: boolean;
    requireSpecMatchForGreen?: boolean;
    stopAfter?: boolean;
}
export interface TrackerView {
    version: 1;
    kind: "overview" | "flow" | "session" | "scenario" | "diff" | "edge";
    subject: {
        app: string;
        session?: string;
        scenario?: string;
        edgeId?: number;
    };
    summary: Record<string, unknown>;
    items: unknown[];
    links: Array<{
        rel: string;
        target: string;
    }>;
    diagnostics: Diagnostic[];
}
