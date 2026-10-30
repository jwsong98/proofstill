import type { AuthCache } from "../types.js";
import type { ActorEvidence } from "../v2/types.js";
export declare function login(profileName: string): Promise<{
    token: string;
    expiresAt?: string;
}>;
export declare function getToken(profileName: string): Promise<string>;
export declare function getTokenWithEvidence(profileName: string, forceLogin?: boolean, source?: "login" | "retry"): Promise<{
    token: string;
    evidence?: ActorEvidence;
}>;
export declare function refreshOnUnauthorized(profileName: string): Promise<string>;
export declare function getAuthStatus(): Promise<AuthCache>;
