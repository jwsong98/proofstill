function normalize(path) {
    if (!path.startsWith("$.")) {
        throw new Error(`Unsupported JSONPath "${path}": expected "$." prefix`);
    }
    return path.slice(2);
}
function readSegment(values, segment) {
    if (segment === "*") {
        return values.flatMap((value) => (Array.isArray(value) ? value : []));
    }
    const arrayMatch = /^(.+)\[\*\]$/.exec(segment);
    if (arrayMatch) {
        const key = arrayMatch[1];
        return values.flatMap((value) => {
            if (value == null || typeof value !== "object")
                return [];
            const child = value[key];
            return Array.isArray(child) ? child : [];
        });
    }
    return values.flatMap((value) => {
        if (value == null || typeof value !== "object")
            return [];
        const child = value[segment];
        return child === undefined ? [] : [child];
    });
}
export function selectJsonPath(root, path) {
    const segments = normalize(path).split(".").filter(Boolean);
    return segments.reduce((values, segment) => readSegment(values, segment), [root]);
}
export function selectOne(root, path) {
    const values = selectJsonPath(root, path);
    return values[0];
}
//# sourceMappingURL=json-path.js.map