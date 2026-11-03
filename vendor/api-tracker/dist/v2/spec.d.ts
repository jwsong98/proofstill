import type { ResolvedApp, SpecCompareResult } from "./types.js";
type RecordValue = Record<string, unknown>;
export declare function loadSpec(filePath: string): Promise<RecordValue>;
export declare function normalizeSpec(spec: RecordValue, ignorePointers?: string[]): RecordValue;
interface OperationEntry {
    key: string;
    method: string;
    path: string;
    operationId?: string;
    value: RecordValue;
}
export declare function compareSpecs(app: ResolvedApp): Promise<SpecCompareResult>;
export declare function generateSpec(app: ResolvedApp, baseUrl?: string): Promise<string>;
export interface SchemaIssue {
    location: string;
    path: string;
    expected: string;
    actual: unknown;
}
export declare function validateOperationRequest(spec: RecordValue, operationId: string, request: {
    params?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: unknown;
}): SchemaIssue[];
export declare function findOperationByRoute(spec: RecordValue, method: string, requestPath: string): OperationEntry | undefined;
export {};
