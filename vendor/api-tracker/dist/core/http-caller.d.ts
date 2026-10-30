import type { ActorEvidence } from "../v2/types.js";
export declare function callApi(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
}): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
}>;
export declare function callWithAuth(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    authProfile?: string;
}): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
    actor?: ActorEvidence;
}>;
