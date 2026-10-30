import type { Config, WsReceivedMessage } from "../types.js";
import type { FlowActionConfig, FlowConfig, FlowSessionState } from "./types.js";
export interface WsCallResult {
    destination: string;
    clientGeneratedId?: string;
    sent: boolean;
    received: {
        count: number;
        matched: boolean;
        matchedMessage?: WsReceivedMessage;
        timeElapsed: number;
    };
    saved: string[];
    observed: string[];
}
export declare function runWsAction(options: {
    config: Config;
    flow: FlowConfig;
    session: string;
    actionId: string;
    action: FlowActionConfig;
    context: Record<string, unknown>;
    workingState: FlowSessionState;
}): Promise<WsCallResult[]>;
