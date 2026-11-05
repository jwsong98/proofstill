import type { Graph, GraphNode } from './types.ts';

export type TaskDefinition = { owns: string[]; checks: string[][] };
export type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'interrupted';
export type TaskResult = {
  nodeId: string; title: string; definition: TaskDefinition; dependsOn: string[];
  status: TaskState; commit: string | null; summary: string; error: string | null;
  checks: { argv: string[]; exitCode: number | null; output: string }[];
  startedAt: number | null; finishedAt: number | null;
};
export type DagRun = {
  id: string; projectId: string; graph: Graph; tasks: TaskResult[];
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: number; finishedAt: number | null;
};

export function normalizeDefinition(input: unknown): TaskDefinition {
  const value = input as TaskDefinition;
  if (!value || !Array.isArray(value.owns) || !value.owns.length || !Array.isArray(value.checks) || !value.checks.length)
    throw new Error('소유 경로와 검사 명령을 각각 하나 이상 지정해 주세요.');
  const owns = [...new Set(value.owns.map(path => {
    if (typeof path !== 'string' || !path.trim() || path !== path.trim() || path.startsWith('/') || path.includes('\\') || /[\0*?\[\]:]/.test(path)) throw new Error('소유 경로는 프로젝트 상대 파일·폴더여야 합니다.');
    const parts = path.replace(/\/$/, '').split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part === '.git' || part === '.proofstill')) throw new Error('소유 경로에 상위·내부 관리 경로를 사용할 수 없습니다.');
    return parts.join('/');
  }))].sort();
  if (value.checks.some(argv => !Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string' || arg.includes('\0')) || !argv[0].trim()))
    throw new Error('검사 명령은 비어 있지 않은 argv 배열이어야 합니다.');
  return { owns, checks: value.checks.map(argv => [...argv]) };
}
export function ownsPath(owns: string[], path: string) { return owns.some(owner => path === owner || path.startsWith(owner + '/')); }
export function ownershipOverlaps(a: string[], b: string[]) { return a.some(path => ownsPath(b, path)) || b.some(path => ownsPath(a, path)); }

export function planTasks(graph: Graph, definitions: Record<string, TaskDefinition>): TaskResult[] {
  const tasks = graph.nodes.filter(node => node.kind === 'task');
  if (!tasks.length) throw new Error('실행할 작업 노드가 없습니다.');
  const taskIds = new Set(tasks.map(node => node.id));
  const ancestors = (node: GraphNode) => {
    const found = new Set<string>(), visiting = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) throw new Error('선후 관계에 순환이 있어 실행할 수 없습니다.');
      visiting.add(id);
      for (const edge of graph.edges.filter(edge => edge.kind === 'precedes' && edge.targetId === id)) {
        if (!graph.nodes.some(node => node.id === edge.sourceId)) throw new Error('선행 노드를 찾을 수 없습니다.');
        if (taskIds.has(edge.sourceId)) found.add(edge.sourceId);
        visit(edge.sourceId);
      }
      visiting.delete(id);
    };
    visit(node.id); return [...found].sort();
  };
  return tasks.map(node => ({ nodeId: node.id, title: node.title, definition: normalizeDefinition(definitions[node.id]), dependsOn: ancestors(node),
    status: 'pending', commit: null, summary: '', error: null, checks: [], startedAt: null, finishedAt: null }));
}
export function readyTasks(tasks: TaskResult[], jobs: number): TaskResult[] {
  const running = tasks.filter(task => task.status === 'running'), ready: TaskResult[] = [];
  for (const task of tasks) {
    if (running.length + ready.length >= jobs) break;
    if (task.status !== 'pending' || task.dependsOn.some(id => tasks.find(other => other.nodeId === id)?.status !== 'completed')) continue;
    if ([...running, ...ready].some(other => ownershipOverlaps(task.definition.owns, other.definition.owns))) continue;
    ready.push(task);
  }
  return ready;
}
