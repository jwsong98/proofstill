function resolveCall(operationId, kind, auth, operations) {
    if (!operationId)
        return null;
    const op = operations.get(operationId);
    return {
        kind,
        operationId,
        method: op?.method,
        path: op?.path,
        auth,
        unresolved: !op,
    };
}
/**
 * Statically expand a scenario into the API calls it walks — without running it.
 * Mirrors the flow runtime: each step fires its action's `calls`, transitions to
 * `action.to`, and (on a state change) the destination screen's `load` calls fire.
 * Goals are standalone calls. Unknown operationIds are kept and flagged
 * `unresolved` so brand-new endpoints still show up in the flow view (as RED).
 */
export function expandScenario(scenario, flow, operations) {
    const steps = [];
    let current = flow.initialState;
    for (const step of scenario.steps ?? []) {
        const state = flow.states[current];
        const action = state?.actions?.[step.action];
        if (!action) {
            steps.push({ action: step.action, from: current, to: current, reachable: false, calls: [] });
            break;
        }
        const calls = [];
        for (const c of action.calls ?? []) {
            const rc = resolveCall(c.operationId, "action", c.auth, operations);
            if (rc)
                calls.push(rc);
        }
        const to = action.to;
        if (to !== current) {
            for (const c of flow.states[to]?.load ?? []) {
                const rc = resolveCall(c.operationId, "load", c.auth, operations);
                if (rc)
                    calls.push(rc);
            }
        }
        steps.push({ action: step.action, from: current, to, reachable: true, calls });
        current = to;
    }
    const goals = [];
    for (const g of scenario.goal ?? []) {
        const rc = resolveCall(g.operationId, "goal", g.auth, operations);
        if (rc)
            goals.push({ name: g.name, call: rc });
    }
    return { steps, goals };
}
//# sourceMappingURL=scenario-expand.js.map