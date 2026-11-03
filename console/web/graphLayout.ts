export type LayoutNode = {
  id: string; x: number; y: number; width: number; height: number;
  vx: number; vy: number; fixed?: boolean;
};
export type LayoutLink = { source: string; target: string };

// Positions are top-left coordinates, matching React Flow. Forces use node centres.
export function stepLayout(nodes: LayoutNode[], links: LayoutLink[], strength = 1): number {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const forces = new Map(nodes.map(node => [node.id, { x: 0, y: 0 }]));
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i], fa = forces.get(a.id)!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j], fb = forces.get(b.id)!;
      let dx = b.x + b.width / 2 - a.x - a.width / 2;
      let dy = b.y + b.height / 2 - a.y - a.height / 2;
      if (Math.abs(dx) + Math.abs(dy) < .01) { dx = i % 2 ? -1 : 1; dy = j % 2 ? 1 : -1; }
      const distance = Math.hypot(dx, dy), ux = dx / distance, uy = dy / distance;
      const repulsion = Math.min(12, 9000 / (distance * distance));
      let fx = ux * repulsion, fy = uy * repulsion;
      const overlapX = (a.width + b.width) / 2 + 32 - Math.abs(dx);
      const overlapY = (a.height + b.height) / 2 + 32 - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) fx += Math.sign(dx || 1) * overlapX * .25;
        else fy += Math.sign(dy || 1) * overlapY * .25;
      }
      fa.x -= fx; fa.y -= fy; fb.x += fx; fb.y += fy;
    }
  }
  for (const link of links) {
    const a = byId.get(link.source), b = byId.get(link.target);
    if (!a || !b || a === b) continue;
    const dx = b.x + b.width / 2 - a.x - a.width / 2;
    const dy = b.y + b.height / 2 - a.y - a.height / 2;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const gap = 80 + Math.max(a.width, a.height, b.width, b.height);
    const force = (distance - gap) * .025;
    const fa = forces.get(a.id)!, fb = forces.get(b.id)!;
    fa.x += dx / distance * force; fa.y += dy / distance * force;
    fb.x -= dx / distance * force; fb.y -= dy / distance * force;
  }
  let movement = 0;
  for (const node of nodes) {
    if (node.fixed) { node.vx = 0; node.vy = 0; continue; }
    const force = forces.get(node.id)!;
    // Weak gravity keeps disconnected components in the same navigable space.
    node.vx = (node.vx + (force.x - (node.x + node.width / 2) * .002) * strength) * .65;
    node.vy = (node.vy + (force.y - (node.y + node.height / 2) * .002) * strength) * .65;
    node.x += Math.max(-20, Math.min(20, node.vx));
    node.y += Math.max(-20, Math.min(20, node.vy));
    movement = Math.max(movement, Math.abs(node.vx), Math.abs(node.vy));
  }
  return movement;
}
