function resolveRequiredInputs(
  flow: FlowConfig,
  state: FlowSessionState,
  actionId: string,
  action: FlowActionConfig,
  rawInputs: Record<string, string>,
): Record<string, ObservedValue> {
  const result: Record<string, ObservedValue> = {};

  for (const [inputName, requirement] of Object.entries(action.requires ?? {})) {
    const requestedId = rawInputs[inputName];
    if (!requestedId) {
      const producers = suggestProducerActions(flow, state.currentState, requirement.observedAs);
      throw new FlowError(
        "MISSING_REQUIRED_INPUT",
        `Missing required input "${inputName}". Run one of these actions first or choose an observed value: ${producers.join(", ")}`,
        { input: inputName, observedAs: requirement.observedAs, producers },
      );
    }

    const candidates = state.observed[requirement.observedAs] ?? [];
    const selected = candidates.find((candidate) => candidate.id === requestedId);
    if (!selected) {
      throw new FlowError(
        "INPUT_NOT_OBSERVED",
        `Input "${inputName}" value "${requestedId}" was not observed as "${requirement.observedAs}"`,
        {
          input: inputName,
          requestedId,
          observedAs: requirement.observedAs,
          candidates: candidates.map((c) => c.id),
        },
      );
    }
    result[inputName] = selected;
  }

  return result;
}

