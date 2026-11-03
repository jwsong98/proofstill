import type { Edge, Ref, Bindings, WsEdgeExtension } from "../types.js";
export declare function recordEdge(options: {
    session: string;
    method: string;
    path: string;
    body?: any;
    authProfile?: string;
    templatePath: string;
    templateBody?: any;
    refs: Ref[];
    response: {
        status: number;
        headers: Record<string, string>;
        body: any;
        actor?: Edge["actor"];
    };
    warnings: string[];
    ws?: WsEdgeExtension;
    actor?: Edge["actor"];
}): Promise<{
    edgeId: number;
    fromNode: number;
    toNode: number;
    newBindings: Bindings;
}>;
