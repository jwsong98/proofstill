import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { getTrackerRoot } from "../storage/file-store.js";
const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
function isRecord(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
/** Follow a single `$ref` like "#/components/schemas/Foo" within the spec. */
function resolveRef(spec, ref) {
    if (!ref.startsWith("#/"))
        return undefined;
    const parts = ref
        .slice(2)
        .split("/")
        .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
    let current = spec;
    for (const part of parts) {
        if (!isRecord(current))
            return undefined;
        current = current[part];
    }
    return current;
}
/** Resolve `$ref` chains, guarding against cycles. */
function deref(spec, schema, seen = new Set()) {
    if (!isRecord(schema))
        return schema;
    const ref = schema.$ref;
    if (typeof ref === "string") {
        if (seen.has(ref))
            return {};
        seen.add(ref);
        return deref(spec, resolveRef(spec, ref), seen);
    }
    return schema;
}
/** Collect top-level object properties of a (possibly `allOf`-composed) schema. */
function extractBodyFields(spec, rawSchema) {
    const properties = {};
    const required = new Set();
    const merge = (node) => {
        const schema = deref(spec, node);
        if (!isRecord(schema))
            return;
        if (Array.isArray(schema.allOf)) {
            for (const part of schema.allOf)
                merge(part);
        }
        if (isRecord(schema.properties)) {
            Object.assign(properties, schema.properties);
        }
        if (Array.isArray(schema.required)) {
            for (const name of schema.required) {
                if (typeof name === "string")
                    required.add(name);
            }
        }
    };
    merge(rawSchema);
    return Object.entries(properties).map(([name, rawProp]) => {
        const prop = deref(spec, rawProp);
        const propRecord = isRecord(prop) ? prop : {};
        const itemsType = propRecord.type === "array"
            ? deref(spec, propRecord.items)?.type
            : undefined;
        return {
            name,
            in: "body",
            type: typeof propRecord.type === "string" ? propRecord.type : undefined,
            required: required.has(name),
            enum: Array.isArray(propRecord.enum) ? propRecord.enum : undefined,
            format: typeof propRecord.format === "string" ? propRecord.format : undefined,
            description: typeof propRecord.description === "string" ? propRecord.description : undefined,
            itemsType: typeof itemsType === "string" ? itemsType : undefined,
        };
    });
}
/** Extract path/query/header parameters, merging path-level and operation-level lists. */
function extractParamFields(spec, pathItemParams, operationParams) {
    const raw = [
        ...(Array.isArray(pathItemParams) ? pathItemParams : []),
        ...(Array.isArray(operationParams) ? operationParams : []),
    ];
    const fields = [];
    for (const entry of raw) {
        const param = deref(spec, entry);
        if (!isRecord(param) || typeof param.name !== "string")
            continue;
        const location = param.in === "path" || param.in === "query" || param.in === "header" ? param.in : "query";
        const schema = isRecord(deref(spec, param.schema)) ? deref(spec, param.schema) : {};
        fields.push({
            name: param.name,
            in: location,
            type: typeof schema.type === "string" ? schema.type : undefined,
            required: typeof param.required === "boolean" ? param.required : location === "path",
            enum: Array.isArray(schema.enum) ? schema.enum : undefined,
            format: typeof schema.format === "string" ? schema.format : undefined,
            description: typeof param.description === "string" ? param.description : undefined,
        });
    }
    return fields;
}
/** Pull the application/json (or first available) request body schema for an operation. */
function requestBodySchema(spec, operation) {
    const requestBody = deref(spec, operation.requestBody);
    if (!isRecord(requestBody) || !isRecord(requestBody.content))
        return undefined;
    const content = requestBody.content;
    const media = content["application/json"] ?? Object.values(content)[0];
    if (!isRecord(media))
        return undefined;
    return media.schema;
}
export async function loadOpenApiOperations(specPath) {
    const resolvedPath = path.isAbsolute(specPath)
        ? specPath
        : path.join(getTrackerRoot(), specPath);
    const raw = await fs.readFile(resolvedPath, "utf-8");
    const spec = specPath.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
    const paths = spec?.paths;
    if (paths == null || typeof paths !== "object") {
        throw new Error("OpenAPI spec does not contain a paths object");
    }
    const result = new Map();
    for (const [apiPath, pathItem] of Object.entries(paths)) {
        if (!isRecord(pathItem))
            continue;
        const pathItemParams = pathItem.parameters;
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!METHODS.has(method.toLowerCase()))
                continue;
            if (!isRecord(operation))
                continue;
            const operationId = operation.operationId;
            if (typeof operationId !== "string" || operationId.length === 0)
                continue;
            if (result.has(operationId)) {
                throw new Error(`Duplicate OpenAPI operationId "${operationId}"`);
            }
            const bodyFields = extractBodyFields(spec, requestBodySchema(spec, operation));
            const paramFields = extractParamFields(spec, pathItemParams, operation.parameters);
            result.set(operationId, {
                operationId,
                method: method.toUpperCase(),
                path: apiPath,
                ...(bodyFields.length > 0 ? { bodyFields } : {}),
                ...(paramFields.length > 0 ? { paramFields } : {}),
            });
        }
    }
    return result;
}
//# sourceMappingURL=openapi-index.js.map