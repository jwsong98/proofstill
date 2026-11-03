import WebSocket from "ws";
import type { WsReceivedMessage } from "../types.js";
export interface StompConnection {
    ws: WebSocket;
    subscriptions: Map<string, MessageBuffer>;
    nextSubId: number;
}
export interface MessageBuffer {
    messages: WsReceivedMessage[];
    listeners: Array<(msg: WsReceivedMessage) => void>;
}
export declare function connectStomp(options: {
    url: string;
    headers?: Record<string, string>;
}): Promise<StompConnection>;
export declare function subscribe(conn: StompConnection, destination: string): MessageBuffer;
export declare function send(conn: StompConnection, destination: string, body: unknown): Promise<void>;
export declare function waitForMessage(buffer: MessageBuffer, options: {
    timeout: number;
    match?: Record<string, unknown>;
}): Promise<{
    matched: WsReceivedMessage | null;
    all: WsReceivedMessage[];
}>;
export declare function disconnect(conn: StompConnection): Promise<void>;
