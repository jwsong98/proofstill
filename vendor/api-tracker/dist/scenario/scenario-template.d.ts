/**
 * Scenario template resolver. Decoupled from flow's renderValue so scenarios can
 * reference their own context (`params`, `baseline`, `saved`, `run`, `env`) and
 * use `${var + N}` / `${var - N}` offsets for baseline-relative counts — the one
 * arithmetic form we allow, deliberately not a general expression language.
 * See docs/scenario-loop-design.md §3.4.
 */
/**
 * Resolve a single string. A whole-string `${expr}` returns the raw typed value
 * (number/object/etc); embedded references are stringified into place.
 */
export declare function resolveString(str: string, ctx: Record<string, unknown>): unknown;
/** Recursively resolve `${...}` templates in strings within any JSON value. */
export declare function resolveDeep(value: unknown, ctx: Record<string, unknown>): unknown;
