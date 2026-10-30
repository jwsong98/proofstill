import type { Edge, SessionMeta } from "../types.js";
export declare function renderEdge(edge: Edge, index: number, total: number, sessionName: string): void;
export declare function browseEdges(edges: Edge[], sessionName: string): Promise<void>;
export declare function browseInteractive(sessions: SessionMeta[], loadEdges: (name: string) => Promise<Edge[]>): Promise<void>;
