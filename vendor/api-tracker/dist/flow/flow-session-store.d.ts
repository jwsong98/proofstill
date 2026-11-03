import type { FlowConfig, FlowSessionState } from "./types.js";
export declare function initialFlowState(flow: FlowConfig, initialState?: string, flowFile?: string): FlowSessionState;
export declare function createFlowSessionState(session: string, flow: FlowConfig, initialState?: string, flowFile?: string): Promise<FlowSessionState>;
export declare function getFlowSessionState(session: string): Promise<FlowSessionState>;
export declare function writeFlowSessionState(session: string, state: FlowSessionState): Promise<void>;
