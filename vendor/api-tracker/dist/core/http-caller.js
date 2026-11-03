import { getTokenWithEvidence } from "./auth-manager.js";
export async function callApi(options) {
    const headers = { ...options.headers };
    if (options.body != null && !headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(options.url, {
        method: options.method,
        headers,
        body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
    const responseHeaders = {};
    res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
    });
    let body;
    const text = await res.text();
    try {
        body = JSON.parse(text);
    }
    catch {
        body = text;
    }
    return { status: res.status, headers: responseHeaders, body };
}
export async function callWithAuth(options) {
    const headers = { ...(options.headers ?? {}) };
    let actor;
    if (options.authProfile) {
        const auth = await getTokenWithEvidence(options.authProfile);
        headers["Authorization"] = `Bearer ${auth.token}`;
        actor = auth.evidence;
    }
    const result = await callApi({
        method: options.method,
        url: options.url,
        headers,
        body: options.body,
    });
    if (result.status === 401 && options.authProfile) {
        const auth = await getTokenWithEvidence(options.authProfile, true, "retry");
        headers["Authorization"] = `Bearer ${auth.token}`;
        const retried = await callApi({
            method: options.method,
            url: options.url,
            headers,
            body: options.body,
        });
        return { ...retried, actor: auth.evidence };
    }
    return { ...result, actor };
}
//# sourceMappingURL=http-caller.js.map