import { readJson, writeJson } from "../storage/file-store.js";
export function initialFlowState(flow, initialState, flowFile) {
    const currentState = initialState ?? flow.initialState;
    if (!flow.states[currentState]) {
        throw new Error(`Initial flow state "${currentState}" is not defined`);
    }
    return {
        currentState,
        ...(flowFile && flowFile !== "flow.yaml" ? { flow: flowFile } : {}),
        saved: {},
        observed: {},
        history: [],
    };
}
export async function createFlowSessionState(session, flow, initialState, flowFile) {
    const state = initialFlowState(flow, initialState, flowFile);
    await writeFlowSessionState(session, state);
    return state;
}
export async function getFlowSessionState(session) {
    const state = await readJson(`sessions/${session}/flow-state.json`);
    if (!state) {
        throw new Error(`Flow state for session "${session}" not found. Run 'flow start' first.`);
    }
    return state;
}
export async function writeFlowSessionState(session, state) {
    await writeJson(`sessions/${session}/flow-state.json`, state);
}
//# sourceMappingURL=flow-session-store.js.map