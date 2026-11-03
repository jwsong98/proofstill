export type NodeKind = 'feature' | 'requirement' | 'issue' | 'decision' | 'task' | 'evidence' | 'result';
export type NodeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'unverified';
export type RelationKind = 'related' | 'precedes';
export type EvidenceKind = 'file' | 'message' | 'execution';
export type Project = { id: string; name: string; rootPath: string; createdAt: number };
export type Evidence = {
  id: string; projectId: string; sourceKind: EvidenceKind;
  source: Record<string, unknown>; content: string; capturedAt: number;
};
export type Execution = {
  id: string; projectId: string; kind: 'test' | 'command' | 'api';
  status: 'passed' | 'failed' | 'interrupted' | 'unverified';
  command: string | null; request: unknown; response: unknown; output: string;
  exitCode: number | null; startedAt: number; finishedAt: number | null;
};
export type GraphNode = {
  id: string; projectId: string; kind: NodeKind; title: string; body: string;
  status: NodeStatus; x: number | null; y: number | null;
  evidenceId: string | null; executionId: string | null; createdAt: number; updatedAt: number;
  mergedRecords?: { id: string; kind: NodeKind; title: string; body: string }[];
  evidence?: Evidence; execution?: Execution; acceptance?: FeatureAcceptance;
};
export type GraphEdge = { id: string; projectId: string; sourceId: string; targetId: string; kind: RelationKind; reason: string; createdAt: number };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Session = {
  id: string; projectId: string; externalThreadId: string | null; title: string;
  source: 'local' | 'import'; role: string | null; createdAt: number;
  lastConversationAt: number | null; contextNodeIds: string[];
};
export type Message = {
  id: string; sessionId: string; externalId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool'; content: string;
  createdAt: number; turnId: string | null;
};
export type SessionEvent = { id: number; sessionId: string; method: string; payload: unknown; createdAt: number };
export type Usage = {
  sessionId: string; turnId: string; inputTokens: number | null; cachedInputTokens: number | null;
  outputTokens: number | null; reasoningOutputTokens: number | null; modelContextWindow: number | null;
  raw: unknown; observedAt: number;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type NodeInput = { id?: string; kind: NodeKind; title: string; body?: string; status?: NodeStatus; x?: number | null; y?: number | null };
export type NodePatch = Partial<Pick<GraphNode, 'title' | 'body' | 'status' | 'x' | 'y'>>;
export type EvidenceInput = { id?: string; title: string; sourceKind: EvidenceKind; source: Record<string, unknown>; content: string; capturedAt?: number };
export type ExecutionInput = {
  id?: string; title: string; kind: Execution['kind']; status: Execution['status']; command?: string | null;
  request?: unknown; response?: unknown; output: string; exitCode?: number | null;
  startedAt?: number; finishedAt?: number | null;
};
export type SessionInput = {
  id?: string; title: string; externalThreadId?: string | null; source?: Session['source'];
  role?: string | null; createdAt?: number; lastConversationAt?: number | null; contextNodeIds?: string[];
};
export type MessageInput = {
  id?: string; externalId?: string | null; role: Message['role']; content: string; createdAt?: number; turnId?: string | null; trackConversation?: boolean;
};
export type UsageInput = {
  turnId?: string; inputTokens?: number | null; cachedInputTokens?: number | null; outputTokens?: number | null;
  reasoningOutputTokens?: number | null; modelContextWindow?: number | null; raw?: unknown; observedAt?: number;
};
export type GraphContext = Graph & { projectId: string; nodeIds: string[]; text: string };

export type FeatureCheckInput = { id: string; label: string; kind: 'scenario' | 'test'; command: string; files?: string[]; purpose?: string; rationale?: string; expected?: string };
export type FeatureCheck = FeatureCheckInput & { projectId: string; featureId: string; executionId: string | null; execution?: Execution };
export type FeatureAcceptance = { checks: FeatureCheck[]; total: number; passed: number; fulfilled: boolean };

export type ImplementationStatus = 'unknown' | 'not_started' | 'in_progress' | 'partial' | 'implemented';
export type ImplementationProgress = { status: ImplementationStatus; paths: string[]; remaining: string; note: string; updatedAt?: number };
export type VerificationStatus = 'not_run' | 'partial' | 'passed' | 'failed' | 'stale' | 'unverified' | 'interrupted';
export type HandoffCheck = { id: string; label: string; kind: string; command: string; status: VerificationStatus; output: string; outputTruncated?: boolean; exitCode: number | null; recordedAt?: string | number | null; files: string[]; scope: string; purpose?: string; rationale?: string; expected?: string; nodeId?: string };
export type HandoffRow = {
  id: string; historical?: boolean; source: 'harness' | 'console'; taskId: string; requirementId: string; title: string; description?: string; mergedRecords?: GraphNode['mergedRecords']; group: string; origin: string;
  implementation: ImplementationProgress;
  verification: { status: VerificationStatus; checks: HandoffCheck[]; review: { status: VerificationStatus; evidence: string } };
  limitations: string[]; nodeId?: string; relatedNodeIds?: string[];
};
export type HandoffSnapshot = { rows: HandoffRow[]; errors: { taskId: string; message: string }[]; generatedAt: string };
