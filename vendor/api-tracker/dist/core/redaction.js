const SENSITIVE_KEY = /^(authorization|proxy-authorization|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|jwt|api[_-]?key)$/i;
export function redactSecrets(value) {
    if (Array.isArray(value))
        return value.map((item) => redactSecrets(item));
    if (value == null || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSecrets(child),
    ]));
}
export function redactSecretText(value) {
    return value
        .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
        .replace(/(["'](?:password|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key)["']\s*[:=]\s*["'])[^"']*/gi, "$1[REDACTED]");
}
//# sourceMappingURL=redaction.js.map