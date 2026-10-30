import type { SessionMeta } from "../types.js";
export declare function createSession(options: {
    name: string;
    continueFrom?: string;
}): Promise<SessionMeta>;
/**
 * Wipe a session's directory and recreate it clean. Used by `scenario run` so
 * each attempt starts from a fresh flow-state/graph while keeping a stable
 * session identity (attempt count is carried in scenario-result.json).
 */
export declare function resetSession(name: string): Promise<SessionMeta>;
export declare function listSessions(): Promise<SessionMeta[]>;
export declare function getSession(name: string): Promise<SessionMeta>;
export declare function updateSessionMeta(name: string, updates: Partial<SessionMeta>): Promise<void>;
export declare function getActiveSession(): Promise<string | null>;
