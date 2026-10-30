import type { OpenApiOperation } from "./types.js";
export declare function loadOpenApiOperations(specPath: string): Promise<Map<string, OpenApiOperation>>;
