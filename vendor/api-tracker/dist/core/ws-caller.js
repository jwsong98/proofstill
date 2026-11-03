import WebSocket from "ws";
import { selectOne } from "../flow/json-path.js";
const DEFAULT_TIMEOUT = 5000;
function buildFrame(command, headers, body) {
    let frame = command + "\n";
    for (const [key, value] of Object.entries(headers)) {
        frame += `${key}:${value}\n`;
    }
    frame += "\n";
    if (body)
        frame += body;
    frame += "\0";
    return frame;
}
function parseFrame(raw) {
    const nullIdx = raw.indexOf("\0");
    const content = nullIdx >= 0 ? raw.slice(0, nullIdx) : raw;
    const headerEnd = content.indexOf("\n\n");
    if (headerEnd === -1)
        return null;
    const headerBlock = content.slice(0, headerEnd);
    const body = content.slice(headerEnd + 2);
    const lines = headerBlock.split("\n");
    const command = lines[0];
    const headers = {};
    for (let i = 1; i < lines.length; i++) {
        const colonIdx = lines[i].indexOf(":");
        if (colonIdx > 0) {
            headers[lines[i].slice(0, colonIdx)] = lines[i].slice(colonIdx + 1);
        }
    }
    return { command, headers, body };
}
export async function connectStomp(options) {
    return new Promise((resolve, reject) => {
        const wsHeaders = {};
        if (options.headers) {
            Object.assign(wsHeaders, options.headers);
        }
        const ws = new WebSocket(options.url, ["v12.stomp", "v11.stomp"], { headers: wsHeaders });
        const conn = { ws, subscriptions: new Map(), nextSubId: 0 };
        ws.on("error", (err) => reject(new Error(`WebSocket connection failed: ${err.message}`)));
        ws.on("open", () => {
            const connectHeaders = {
                "accept-version": "1.2",
                "heart-beat": "0,0",
            };
            ws.send(buildFrame("CONNECT", connectHeaders));
        });
        ws.on("message", (data) => {
            const raw = data.toString();
            if (raw === "\n" || raw === "\r\n")
                return;
            const frame = parseFrame(raw);
            if (!frame)
                return;
            if (frame.command === "CONNECTED") {
                setupMessageRouter(conn);
                resolve(conn);
                return;
            }
            if (frame.command === "ERROR") {
                reject(new Error(`STOMP ERROR: ${frame.headers["message"] ?? frame.body}`));
            }
        });
    });
}
function setupMessageRouter(conn) {
    conn.ws.on("message", (data) => {
        const raw = data.toString();
        if (raw === "\n" || raw === "\r\n")
            return;
        const frame = parseFrame(raw);
        if (!frame || frame.command !== "MESSAGE")
            return;
        const destination = frame.headers["destination"] ?? "";
        const subId = frame.headers["subscription"] ?? "";
        let body;
        try {
            body = JSON.parse(frame.body);
        }
        catch {
            body = frame.body;
        }
        const msg = {
            destination,
            body,
            timestamp: new Date().toISOString(),
        };
        const buffer = conn.subscriptions.get(subId);
        if (buffer) {
            buffer.messages.push(msg);
            for (const listener of buffer.listeners) {
                listener(msg);
            }
        }
    });
}
export function subscribe(conn, destination) {
    const subId = `sub-${conn.nextSubId++}`;
    const buffer = { messages: [], listeners: [] };
    conn.subscriptions.set(subId, buffer);
    conn.ws.send(buildFrame("SUBSCRIBE", { id: subId, destination }));
    return buffer;
}
export async function send(conn, destination, body) {
    const content = typeof body === "string" ? body : JSON.stringify(body);
    conn.ws.send(buildFrame("SEND", { destination, "content-type": "application/json" }, content));
}
export async function waitForMessage(buffer, options) {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const alreadyMatched = findMatch(buffer.messages, options.match);
    if (alreadyMatched) {
        return { matched: alreadyMatched, all: [...buffer.messages] };
    }
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            cleanup();
            const last = options.match ? null : buffer.messages[buffer.messages.length - 1] ?? null;
            resolve({ matched: last, all: [...buffer.messages] });
        }, timeout);
        const listener = (msg) => {
            if (options.match) {
                const m = findMatch([msg], options.match);
                if (m) {
                    cleanup();
                    resolve({ matched: m, all: [...buffer.messages] });
                }
            }
            else {
                cleanup();
                resolve({ matched: msg, all: [...buffer.messages] });
            }
        };
        buffer.listeners.push(listener);
        function cleanup() {
            clearTimeout(timer);
            const idx = buffer.listeners.indexOf(listener);
            if (idx >= 0)
                buffer.listeners.splice(idx, 1);
        }
    });
}
function findMatch(messages, match) {
    if (!match)
        return messages[0] ?? null;
    for (const msg of messages) {
        const root = { body: msg.body };
        const allMatch = Object.entries(match).every(([path, expected]) => {
            const actual = selectOne(root, path);
            return actual !== undefined && actual === expected;
        });
        if (allMatch)
            return msg;
    }
    return null;
}
export async function disconnect(conn) {
    return new Promise((resolve) => {
        try {
            conn.ws.send(buildFrame("DISCONNECT", { receipt: "disconnect-receipt" }));
        }
        catch {
            // already closed
        }
        conn.ws.close();
        conn.ws.on("close", () => resolve());
        setTimeout(() => resolve(), 1000);
    });
}
//# sourceMappingURL=ws-caller.js.map