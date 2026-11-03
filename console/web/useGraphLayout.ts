import { useCallback, useEffect, useRef, useState } from 'react';
import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';
import { stepLayout, type LayoutNode, type LayoutLink } from './graphLayout.ts';

export function useGraphLayout<N extends Node>(input: N[], links: LayoutLink[], onSettled: () => void, initialPinned: string[] = []) {
  const [nodes, setNodes] = useState<N[]>(input);
  const current = useRef(input);
  const positions = useRef(new Map<string, LayoutNode>());
  const pinned = useRef(new Set(initialPinned));
  const dragging = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const ticks = useRef(0);
  const linksRef = useRef(links);
  const settled = useRef(onSettled);
  const topology = JSON.stringify([input.map(node => node.id).sort(), links.map(link => [link.source, link.target]).sort()]);
  const lastTopology = useRef('');
  linksRef.current = links;
  settled.current = onSettled;

  const publish = useCallback((next: N[]) => { current.current = next; setNodes(next); }, []);
  const restart = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    ticks.current = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const run = () => {
      const bodies = current.current.map(node => {
        let body = positions.current.get(node.id);
        if (!body) {
          body = { id: node.id, ...node.position, width: 132, height: 80, vx: 0, vy: 0 };
          positions.current.set(node.id, body);
        }
        body.width = node.measured?.width ?? 132;
        body.height = node.measured?.height ?? 80;
        body.fixed = pinned.current.has(node.id) || dragging.current === node.id;
        return body;
      });
      let movement = 0;
      const steps = reducedMotion ? 240 : 2;
      for (let i = 0; i < steps; i++) movement = stepLayout(bodies, linksRef.current);
      publish(current.current.map(node => {
        const body = positions.current.get(node.id)!;
        return { ...node, position: { x: body.x, y: body.y } };
      }));
      ticks.current += steps;
      if (!reducedMotion && ticks.current < 360 && (ticks.current < 40 || movement > .12 || dragging.current)) {
        frame.current = requestAnimationFrame(run);
      } else {
        frame.current = null;
        settled.current();
      }
    };
    frame.current = requestAnimationFrame(run);
  }, [publish]);

  useEffect(() => {
    const changed = lastTopology.current !== topology;
    lastTopology.current = topology;
    const existing = new Map(current.current.map(node => [node.id, node]));
    publish(input.map(node => {
      const previous = existing.get(node.id);
      const body = positions.current.get(node.id);
      return { ...node, measured: previous?.measured, dragging: previous?.dragging,
        position: body ? { x: body.x, y: body.y } : previous?.position ?? node.position };
    }));
    if (changed) restart();
    // Metadata/selection updates must preserve positions and must not reheat the layout.
  }, [input, topology, publish, restart]);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const onNodesChange = useCallback((changes: NodeChange<N>[]) => {
    let resized = false;
    for (const change of changes) {
      if (change.type === 'dimensions') {
        const previous = current.current.find(node => node.id === change.id)?.measured;
        resized ||= previous?.width !== change.dimensions?.width || previous?.height !== change.dimensions?.height;
      }
      if (change.type === 'position' && change.position) {
        const body = positions.current.get(change.id);
        if (body) Object.assign(body, change.position, { vx: 0, vy: 0 });
        if (change.dragging !== undefined) {
          pinned.current.add(change.id);
          dragging.current = change.dragging ? change.id : null;
        }
      }
    }
    publish(applyNodeChanges(changes, current.current));
    if (resized || changes.some(change => change.type === 'position' && change.dragging !== undefined)) restart();
  }, [publish, restart]);

  const rearrange = useCallback(() => { pinned.current.clear(); restart(); }, [restart]);
  return { nodes, onNodesChange, rearrange };
}
