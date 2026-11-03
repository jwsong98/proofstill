/**
 * A guard/validation failure in the flow runtime, carrying a machine-readable
 * code and structured details so the CLI can surface it to an agent as JSON
 * ({ ok: false, error: { code, message, ...details } }).
 */
export class FlowError extends Error {
    code;
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.name = "FlowError";
        this.code = code;
        this.details = details;
    }
}
//# sourceMappingURL=flow-errors.js.map