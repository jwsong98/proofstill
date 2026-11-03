export interface InitResult {
    root: string;
    created: string[];
    skipped: string[];
}
export declare function initProject(options?: {
    force?: boolean;
}): Promise<InitResult>;
