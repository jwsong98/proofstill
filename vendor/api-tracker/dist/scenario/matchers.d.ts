/**
 * Structural matchers for goal assertions. A scenario asserts on the *shape* and
 * *relation* of server-generated values it cannot know ahead of time (uuids,
 * timestamps), not literal equality. See docs/scenario-loop-design.md §3.4.
 *
 * Pure module: expected values must already be template-resolved by the caller.
 */
declare const MATCHER_KEYS: readonly ["equals", "exists", "isUuid", "matches", "contains", "length", "minLength", "gt", "gte", "lt", "lte", "after", "before"];
export type MatcherName = (typeof MATCHER_KEYS)[number];
export interface NormalizedSpec {
    matcher: MatcherName;
    expected: unknown;
}
export interface MatchFailure {
    path: string;
    matcher: MatcherName;
    expected: unknown;
    actual: unknown;
}
/**
 * Interpret a raw matcher spec. A one-key object whose key is a known matcher
 * (e.g. `{ isUuid: true }`, `{ after: "..." }`) selects that matcher; anything
 * else (a string/number/bool/array, or a plain object) is an `equals` target.
 */
export declare function normalizeSpec(spec: unknown): NormalizedSpec;
/**
 * Evaluate one assertion against the JSONPath match set. Returns a failure
 * describing expected vs actual, or null when it holds. `matches` is the array
 * selectJsonPath returns; single-value paths use `matches[0]`.
 */
export declare function evaluateAssertion(matches: unknown[], spec: NormalizedSpec, path: string): MatchFailure | null;
export {};
