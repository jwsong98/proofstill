import { randomUUID } from "node:crypto";
import { connectStomp, subscribe, send, waitForMessage, disconnect, } from "../core/ws-caller.js";
import { getToken } from "../core/auth-manager.js";
import { recordEdge } from "../core/recorder.js";
import { selectJsonPath, selectOne } from "./json-path.js";
export async function runWsAction(options) {
    const { config, flow, session, actionId, action, context, workingState } = options;
    const wsConfig = flow.ws;
    if (!wsConfig) {
        throw new Error("flow.yaml is missing 'ws' configuration for WebSocket actions");
    }
    const baseUrl = config.server.baseUrl.replace(/^http/, "ws");
    const wsUrl = `${baseUrl}${wsConfig.endpoint}`;
    const defaultTimeout = wsConfig.timeout ?? 5000;
    const headers = {};
    const authProfile = action.calls?.[0]?.auth ?? flow.defaultAuth;
    if (authProfile) {
        const token = await getToken(authProfile);
        headers["Authorization"] = `Bearer ${token}`;
    }
    const conn = await connectStomp({ url: wsUrl, headers });
    const results = [];
    try {
        const subscribeDest = action.subscribe
            ? renderTemplate(action.subscribe, context)
            : undefined;
        for (const call of action.calls ?? []) {
            const result = await runSingleWsCall({
                conn,
                call,
                context,
                subscribeDest,
                defaultTimeout,
                session,
                actionId,
                workingState,
            });
            results.push(result);
        }
    }
    finally {
        await disconnect(conn);
    }
    return results;
}
async function runSingleWsCall(options) {
    const { conn, call, context, subscribeDest, defaultTimeout, session, actionId, workingState } = options;
    let clientGeneratedId;
    if (call.clientId) {
        clientGeneratedId = randomUUID();
        context["_clientId"] = clientGeneratedId;
    }
    const destination = call.destination
        ? renderTemplate(call.destination, context)
        : undefined;
    if (!destination) {
        throw new Error(`WebSocket call "${call.id ?? "unknown"}" is missing 'destination'`);
    }
    const body = call.body != null ? renderValue(call.body, context) : undefined;
    const buffer = subscribeDest ? subscribe(conn, subscribeDest) : undefined;
    await send(conn, destination, body);
    const startTime = Date.now();
    let matched = null;
    let allReceived = [];
    let receiveMatched = false;
    const receiveExpect = call.expect?.receive;
    if (buffer && receiveExpect) {
        const timeout = receiveExpect.timeout ?? defaultTimeout;
        const matchConditions = receiveExpect.match
            ? Object.fromEntries(Object.entries(receiveExpect.match).map(([path, val]) => [
                path,
                typeof val === "string" ? renderValue(val, context) : val,
            ]))
            : undefined;
        const result = await waitForMessage(buffer, {
            timeout,
            match: matchConditions,
        });
        matched = result.matched;
        allReceived = result.all;
        receiveMatched = matched != null;
    }
    else if (buffer) {
        await new Promise((r) => setTimeout(r, 200));
        allReceived = [...buffer.messages];
        matched = allReceived[0] ?? null;
        receiveMatched = allReceived.length > 0;
    }
    const timeElapsed = Date.now() - startTime;
    const responseBody = matched?.body ?? null;
    const observedKeys = applyObserve(workingState, actionId, call, responseBody);
    const savedKeys = applySave(workingState, call, responseBody, context);
    const warnings = [];
    if (receiveExpect && !receiveMatched) {
        warnings.push("WS_RECEIVE_TIMEOUT");
    }
    await recordEdge({
        session,
        method: "WS",
        path: destination,
        body,
        authProfile: call.auth,
        templatePath: call.destination ?? destination,
        templateBody: call.body,
        refs: [],
        response: {
            status: receiveMatched ? 200 : 408,
            headers: {},
            body: responseBody,
        },
        warnings,
        ws: {
            protocol: "ws",
            destination,
            subscribe: subscribeDest,
            clientGeneratedId,
            received: allReceived,
            matchedMessage: matched ?? undefined,
        },
    });
    return {
        destination,
        clientGeneratedId,
        sent: true,
        received: {
            count: allReceived.length,
            matched: receiveMatched,
            matchedMessage: matched ?? undefined,
            timeElapsed,
        },
        saved: savedKeys,
        observed: observedKeys,
    };
}
function renderTemplate(template, context) {
    return template.replace(/\$\{([^}]+)\}/g, (_, expr) => {
        const value = readContext(context, expr);
        return String(value);
    });
}
function renderValue(value, context) {
    if (typeof value === "string") {
        const only = /^\$\{([^}]+)\}$/.exec(value);
        if (only)
            return readContext(context, only[1]);
        return value.replace(/\$\{([^}]+)\}/g, (_, expr) => String(readContext(context, expr)));
    }
    if (Array.isArray(value)) {
        return value.map((item) => renderValue(item, context));
    }
    if (value != null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [
            key,
            renderValue(child, context),
        ]));
    }
    return value;
}
function readContext(context, expression) {
    const parts = expression.split(".");
    let current = context;
    for (const part of parts) {
        if (current == null || typeof current !== "object") {
            throw new Error(`Cannot resolve template "\${${expression}}"`);
        }
        current = current[part];
    }
    if (current === undefined) {
        throw new Error(`Cannot resolve template "\${${expression}}"`);
    }
    return current;
}
function applySave(state, call, responseBody, context) {
    if (!responseBody)
        return [];
    const saved = [];
    const root = { body: responseBody };
    for (const [key, path] of Object.entries(call.save ?? {})) {
        const value = selectOne(root, path);
        if (value !== undefined) {
            state.saved[key] = value;
            context[key] = value;
            saved.push(key);
        }
    }
    return saved;
}
function applyObserve(state, actionId, call, responseBody) {
    if (!responseBody)
        return [];
    const observed = [];
    const root = { body: responseBody };
    const callId = call.id ?? call.destination ?? "ws-call";
    for (const [key, spec] of Object.entries(call.observe ?? {})) {
        const ids = selectJsonPath(root, spec.id);
        const labels = spec.label ? selectJsonPath(root, spec.label) : [];
        const existing = state.observed[key] ?? [];
        const byId = new Map(existing.map((entry) => [entry.id, entry]));
        ids.forEach((id, index) => {
            if (id == null)
                return;
            const idString = String(id);
            byId.set(idString, {
                id: idString,
                label: labels[index] == null ? undefined : String(labels[index]),
                value: id,
                source: { action: actionId, call: callId },
            });
        });
        state.observed[key] = [...byId.values()];
        observed.push(key);
    }
    return observed;
}
//# sourceMappingURL=ws-action-runner.js.map