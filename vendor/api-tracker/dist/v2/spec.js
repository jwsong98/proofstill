import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { runAdapter } from "./adapter.js";
import { getTrackerRoot } from "../storage/file-store.js";
const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
function isRecord(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
export async function loadSpec(filePath) {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(getTrackerRoot(), filePath);
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed = resolvedPath.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.paths))
        throw new Error(`Invalid OpenAPI document: ${resolvedPath}`);
    return parsed;
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function removePointer(root, pointer) {
    const tokens = pointer.replace(/^\//, "").split("/").filter(Boolean).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (tokens.length === 0)
        return;
    let current = root;
    for (let index = 0; index < tokens.length - 1; index++) {
        if (!isRecord(current))
            return;
        current = current[tokens[index]];
    }
    if (isRecord(current))
        delete current[tokens[tokens.length - 1]];
}
function sortDeep(value) {
    if (Array.isArray(value))
        return value.map(sortDeep);
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}
const DOCUMENTATION_KEYS = new Set(["description", "summary", "title", "example", "examples", "externalDocs"]);
function semanticShape(value) {
    if (Array.isArray(value))
        return value.map(semanticShape);
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !DOCUMENTATION_KEYS.has(key) && !key.startsWith("x-"))
        .map(([key, child]) => [key, semanticShape(child)]));
}
export function normalizeSpec(spec, ignorePointers = []) {
    const normalized = clone(spec);
    for (const pointer of ignorePointers)
        removePointer(normalized, pointer);
    return sortDeep(normalized);
}
function fingerprint(value) {
    return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
function operations(spec) {
    const result = new Map();
    for (const [apiPath, item] of Object.entries(spec.paths)) {
        if (!isRecord(item))
            continue;
        const pathParameters = Array.isArray(item.parameters) ? item.parameters : [];
        for (const [method, rawOperation] of Object.entries(item)) {
            if (!METHODS.has(method.toLowerCase()) || !isRecord(rawOperation))
                continue;
            const operationId = typeof rawOperation.operationId === "string" ? rawOperation.operationId : undefined;
            const key = operationId ? `id:${operationId}` : `route:${method.toUpperCase()} ${apiPath}`;
            if (result.has(key))
                throw new Error(`Duplicate OpenAPI operation key ${key}`);
            const operationParameters = Array.isArray(rawOperation.parameters) ? rawOperation.parameters : [];
            const value = pathParameters.length > 0
                ? { ...rawOperation, parameters: [...pathParameters, ...operationParameters] }
                : rawOperation;
            result.set(key, { key, method: method.toUpperCase(), path: apiPath, operationId, value });
        }
    }
    return result;
}
export async function compareSpecs(app) {
    const contract = normalizeSpec(await loadSpec(app.contractPath), app.app.specs.ignorePointers);
    const generated = normalizeSpec(await loadSpec(app.generatedPath), app.app.specs.ignorePointers);
    const expected = operations(contract);
    const actual = operations(generated);
    const changes = [];
    for (const [key, operation] of expected) {
        const other = actual.get(key);
        if (!other) {
            changes.push({ kind: "operation_missing_in_generated", severity: "error", operationId: operation.operationId, method: operation.method, path: operation.path });
            continue;
        }
        if (JSON.stringify(sortDeep(semanticShape(operation.value))) !== JSON.stringify(sortDeep(semanticShape(other.value))) || operation.method !== other.method || operation.path !== other.path) {
            changes.push({ kind: "operation_incompatible", severity: "error", operationId: operation.operationId, method: operation.method, path: operation.path, expected: operation.value, actual: other.value });
        }
    }
    for (const [key, operation] of actual) {
        if (!expected.has(key))
            changes.push({ kind: "operation_missing_in_contract", severity: "warning", operationId: operation.operationId, method: operation.method, path: operation.path });
    }
    const contractOnly = changes.filter((change) => change.kind === "operation_missing_in_generated").length;
    const generatedOnly = changes.filter((change) => change.kind === "operation_missing_in_contract").length;
    const incompatible = changes.filter((change) => change.kind === "operation_incompatible").length;
    const status = incompatible > 0 ? "incompatible" : contractOnly > 0 && generatedOnly === 0 ? "contract_ahead" : generatedOnly > 0 && contractOnly === 0 ? "implementation_ahead" : changes.length > 0 ? "incompatible" : "match";
    const result = {
        status,
        summary: { contractOnly, generatedOnly, incompatible },
        changes,
        contractFingerprint: fingerprint(contract),
        generatedFingerprint: fingerprint(generated),
    };
    await fs.mkdir(app.runtimeRoot, { recursive: true });
    await fs.writeFile(path.join(app.runtimeRoot, "spec-compare.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return result;
}
export async function generateSpec(app, baseUrl) {
    await fs.mkdir(path.dirname(app.generatedPath), { recursive: true });
    const temp = `${app.generatedPath}.${process.pid}.tmp`;
    await runAdapter(app, "generate-openapi", ["--output", temp], baseUrl ? { API_TRACKER_BASE_URL: baseUrl } : {});
    await loadSpec(temp);
    await fs.rename(temp, app.generatedPath);
    return app.generatedPath;
}
function resolveRef(spec, schema, seen = new Set()) {
    if (!isRecord(schema) || typeof schema.$ref !== "string")
        return schema;
    const ref = schema.$ref;
    if (!ref.startsWith("#/") || seen.has(ref))
        return {};
    seen.add(ref);
    let current = spec;
    for (const part of ref.slice(2).split("/").map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"))) {
        if (!isRecord(current))
            return {};
        current = current[part];
    }
    return resolveRef(spec, current, seen);
}
function validateSchema(spec, rawSchema, value, pointer, location, issues) {
    const schema = resolveRef(spec, rawSchema);
    if (!isRecord(schema))
        return;
    if (schema.nullable === true && value === null)
        return;
    if (Array.isArray(schema.allOf))
        for (const item of schema.allOf)
            validateSchema(spec, item, value, pointer, location, issues);
    if (Array.isArray(schema.oneOf)) {
        const matches = schema.oneOf.filter((item) => { const local = []; validateSchema(spec, item, value, pointer, location, local); return local.length === 0; });
        if (matches.length !== 1)
            issues.push({ location, path: pointer, expected: "exactly one oneOf schema", actual: value });
        return;
    }
    // Path/query/header parameters travel as strings on the wire, so a schema
    // type of integer/number/boolean is satisfied by the string form ("10", "true").
    // Body values keep their real JSON types and are checked strictly.
    const inParam = location !== "body";
    if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value) || (inParam && String(candidate) === String(value)))) {
        issues.push({ location, path: pointer, expected: `enum(${schema.enum.join(", ")})`, actual: value });
    }
    const type = schema.type;
    const numericString = inParam && typeof value === "string" && value.trim() !== "";
    const isInteger = typeof value === "number" ? Number.isInteger(value) : Boolean(numericString && /^-?\d+$/.test(value));
    const isNumber = typeof value === "number" || Boolean(numericString && Number.isFinite(Number(value)));
    const isBoolean = typeof value === "boolean" || (inParam && (value === "true" || value === "false"));
    const validType = type === "object" ? isRecord(value) : type === "array" ? Array.isArray(value) : type === "integer" ? isInteger : type === "number" ? isNumber : type === "string" ? typeof value === "string" : type === "boolean" ? isBoolean : true;
    if (!validType) {
        issues.push({ location, path: pointer, expected: String(type), actual: value });
        return;
    }
    if (type === "string" && typeof value === "string" && typeof schema.format === "string") {
        const formatValidators = {
            // Lenient 8-4-4-4-12 hex, matching Java UUID.fromString / Postgres uuid.
            // Do not enforce RFC 4122 version/variant bits: structured seed ids such as
            // 50000000-0000-0000-0000-000000000001 are accepted by the server and must
            // not be rejected by the contract validator (which would be stricter than the app).
            uuid: (candidate) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate),
            email: (candidate) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate),
            date: (candidate) => /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)),
            "date-time": (candidate) => /^\d{4}-\d{2}-\d{2}T/.test(candidate) && !Number.isNaN(Date.parse(candidate)),
        };
        const validator = formatValidators[schema.format];
        if (validator && !validator(value))
            issues.push({ location, path: pointer, expected: `format(${schema.format})`, actual: value });
    }
    if (type === "object" && isRecord(value)) {
        const required = Array.isArray(schema.required) ? schema.required.filter((item) => typeof item === "string") : [];
        for (const key of required)
            if (!(key in value))
                issues.push({ location, path: `${pointer}.${key}`, expected: "required", actual: undefined });
        if (isRecord(schema.properties))
            for (const [key, child] of Object.entries(schema.properties))
                if (key in value)
                    validateSchema(spec, child, value[key], `${pointer}.${key}`, location, issues);
    }
    if (type === "array" && Array.isArray(value) && schema.items)
        value.forEach((item, index) => validateSchema(spec, schema.items, item, `${pointer}[${index}]`, location, issues));
}
export function validateOperationRequest(spec, operationId, request) {
    const entry = [...operations(spec).values()].find((operation) => operation.operationId === operationId);
    if (!entry)
        throw new Error(`Unknown operationId "${operationId}"`);
    const issues = [];
    const parameters = Array.isArray(entry.value.parameters) ? entry.value.parameters : [];
    for (const raw of parameters) {
        const param = resolveRef(spec, raw);
        if (!isRecord(param) || typeof param.name !== "string")
            continue;
        const source = param.in === "header" ? request.headers ?? {} : request.params ?? {};
        const value = source[param.name];
        if (param.required === true && value === undefined)
            issues.push({ location: String(param.in ?? "query"), path: param.name, expected: "required", actual: undefined });
        if (value !== undefined)
            validateSchema(spec, param.schema, value, param.name, String(param.in ?? "query"), issues);
    }
    const requestBody = resolveRef(spec, entry.value.requestBody);
    if (isRecord(requestBody)) {
        if (requestBody.required === true && request.body === undefined)
            issues.push({ location: "body", path: "$", expected: "required", actual: undefined });
        if (request.body !== undefined && isRecord(requestBody.content)) {
            const media = requestBody.content["application/json"] ?? Object.values(requestBody.content)[0];
            if (isRecord(media))
                validateSchema(spec, media.schema, request.body, "$", "body", issues);
        }
    }
    return issues;
}
export function findOperationByRoute(spec, method, requestPath) {
    const normalizedMethod = method.toUpperCase();
    return [...operations(spec).values()].find((operation) => {
        if (operation.method !== normalizedMethod)
            return false;
        const pattern = operation.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[^}]+\\\}/g, "[^/]+");
        return new RegExp(`^${pattern}$`).test(requestPath.split("?")[0]);
    });
}
//# sourceMappingURL=spec.js.map