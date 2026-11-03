import type { AppResult, ResolvedApp } from "./types.js";
export declare const ADAPTER_NAMES: readonly ["server-start", "server-stop", "server-reset", "server-health", "generate-openapi"];
export type AdapterName = (typeof ADAPTER_NAMES)[number];
export interface AdapterOutput {
    ok: boolean;
    [key: string]: unknown;
}
export declare function doctorApp(app: ResolvedApp): Promise<AppResult<{
    appId: string;
    adapterRoot: string;
    scripts: Array<{
        name: AdapterName;
        path: string;
        exists: boolean;
        executable: boolean;
    }>;
}>>;
export declare function runAdapter(app: ResolvedApp, name: AdapterName, args?: string[], env?: Record<string, string>): Promise<AdapterOutput>;
export declare function createAdapterScaffolds(appRoot: string, adapterDir: string): Promise<string[]>;
