interface StorageContext {
    trackerRoot?: string;
    appId?: string;
}
export declare function withStorageContext<T>(context: StorageContext, task: () => Promise<T>): Promise<T>;
export declare function getActiveAppId(): string | undefined;
export declare function getTrackerRoot(): string;
export declare function readJson<T>(relativePath: string): Promise<T | null>;
export declare function writeJson(relativePath: string, data: unknown): Promise<void>;
export declare function removeDir(relativePath: string): Promise<void>;
export declare function readYaml<T>(relativePath: string): Promise<T>;
export declare function writeYaml(relativePath: string, data: unknown): Promise<void>;
export declare function exists(relativePath: string): Promise<boolean>;
export declare function listDirs(relativePath: string): Promise<string[]>;
export declare function listFiles(relativePath: string): Promise<string[]>;
export {};
