import type { Ref, Bindings } from "../types.js";
export declare function resolveTemplate(template: string, bindings: Bindings): {
    resolved: string;
    refs: Ref[];
};
export declare function resolveRequest(request: {
    path: string;
    body?: any;
}, bindings: Bindings): {
    resolved: {
        path: string;
        body?: any;
    };
    refs: Ref[];
};
export declare function inferRefs(request: {
    path: string;
    body?: any;
}, bindings: Bindings): Ref[];
export declare function extractBindings(edgeId: number, toNode: number, responseBody: any): Record<string, {
    value: any;
    origin: string;
    jsonPath: string;
}>;
