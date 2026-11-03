import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLayout, type LayoutNode, type LayoutLink } from '../web/graphLayout.ts';

function node(id: string, x = 0, y = 0): LayoutNode {
  return { id, x, y, width: 132, height: 100, vx: 0, vy: 0 };
}
function settle(nodes: LayoutNode[], links: LayoutLink[] = []) {
  for (let i = 0; i < 360; i++) stepLayout(nodes, links);
  for (const n of nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
}
function distance(a: LayoutNode, b: LayoutNode) { return Math.hypot(a.x - b.x, a.y - b.y); }

test('coincident nodes separate with enough space for labels and task summaries', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => node(String(i)));
  settle(nodes);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    assert.ok(Math.abs(nodes[i].x - nodes[j].x) >= 132 || Math.abs(nodes[i].y - nodes[j].y) >= 100, `${i} overlaps ${j}`);
  }
});

test('connections pull related nodes closer than unrelated ones', () => {
  const connected = [node('a', -600), node('b', 600)];
  const unrelated = structuredClone(connected);
  settle(connected, [{ source: 'a', target: 'b' }]); settle(unrelated);
  assert.ok(distance(...connected as [LayoutNode, LayoutNode]) < distance(...unrelated as [LayoutNode, LayoutNode]));
});

test('removing visible nodes closes empty space; new nodes reflow without overlap', () => {
  const nodes = [node('a', -200), node('b'), node('c', 200)];
  settle(nodes);
  const before = distance(nodes[0], nodes[2]);
  const visible = [nodes[0], nodes[2]];
  settle(visible);
  assert.ok(distance(...visible as [LayoutNode, LayoutNode]) < before);
  visible.push(node('added', visible[0].x, visible[0].y));
  settle(visible, [{ source: 'a', target: 'added' }]);
  assert.ok(Math.abs(visible[0].x - visible[2].x) >= 132 || Math.abs(visible[0].y - visible[2].y) >= 100);
});

test('dragged node stays under the pointer while neighbours move, including missing/hidden link endpoints', () => {
  const fixed = { ...node('drag', 300, 200), fixed: true };
  const neighbour = node('other', 300, 200);
  settle([fixed, neighbour], [{ source: 'drag', target: 'other' }, { source: 'hidden', target: 'other' }]);
  assert.equal(fixed.x, 300); assert.equal(fixed.y, 200);
  assert.ok(distance(fixed, neighbour) > 100);
  settle([]); settle([node('single')]);
});
