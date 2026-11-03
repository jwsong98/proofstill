export function detectUnreachable(refs) {
    return refs
        .filter((ref) => ref.source === "unknown")
        .map((ref) => `UNREACHABLE_SUSPECT: '${ref.value}' has no known source in previous responses`);
}
//# sourceMappingURL=unreachable.js.map