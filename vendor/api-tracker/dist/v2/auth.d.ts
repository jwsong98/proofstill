import type { ActorEvidence, AppResult, ResolvedApp } from "./types.js";
export declare function actorAuthStatus(app: ResolvedApp): Promise<AppResult>;
export declare function forgetActorAuth(app: ResolvedApp, actorId: string): Promise<AppResult>;
export declare function resolveActorAuth(app: ResolvedApp, actorId?: string, forceLogin?: boolean, source?: "login" | "retry"): Promise<{
    token?: string;
    evidence: ActorEvidence;
}>;
export declare function callWithActor(options: {
    app: ResolvedApp;
    actorId?: string;
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
}): Promise<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
    actor: ActorEvidence;
}>;
