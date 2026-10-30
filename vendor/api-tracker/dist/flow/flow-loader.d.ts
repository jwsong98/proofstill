import type { Config } from "../types.js";
import type { FlowConfig } from "./types.js";
export declare function loadFlowConfig(relativePath?: string): Promise<FlowConfig>;
export declare function validateFlowConfig(flow: FlowConfig, config: Config): Promise<void>;
