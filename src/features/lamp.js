import { GROUND } from '../core/dims.js';
import { VERTS, vAdj } from '../core/grid.js';
import { has } from '../core/model.js';
import { C } from '../core/palette.js';
import { hash, l2, lin, norm2, sub2 } from '../core/util.js';
import { boxAt, rod } from '../geom/builder.js';
import { alongPath, edgeKey, hasInterior, onRoute, sideKey } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';

// Street lighting stands where real towns put it: a post at the kerb of a quay, on the side of the path
// rather than in it; a lantern on a bracket where a house wall lines the street; a free-standing post
// only in the middle of a square that people can walk around.
export function lampSpot(v) {
  const side = list => list.map(n => ({ n, a: alongPath(v, norm2(sub2(VERTS[n], VERTS[v]))) }))
    .filter(c => c.a < 0.75).sort((p, q) => p.a - q.a || hash(v, p.n, 0, 76) - hash(v, q.n, 0, 76));
  const kerb = side(vAdj[v].filter(n => !has(n, 0) && !PLAN.edge.has(edgeKey(v, n))));
  if (kerb.length) return { at: 'kerb', n: kerb[0].n };
  const wall = side(vAdj[v].filter(n => has(n, 1) && !PLAN.side.has(sideKey(n, v, 1))));
  if (wall.length) return { at: 'wall', n: wall[0].n };
  if (hasInterior(v) && !onRoute(v)) return { at: 'square' };
  return null;
}
export default {
  kind: 'lamp', slot: 'node',
  rule: { ctx: k => k === 'plaza' || k === 'quay' || k === 'lane', needs: v => !!lampSpot(v), spacing: 2.4, p: 1,
    why: 'lights the street from its edge' },
  check: v => (lampSpot(v) ? null : 'lamp with nowhere to stand off the walkway'),
  draw(bld, { v, x, z }) {
    const spot = lampSpot(v), iron = lin('#4a5560');
    if (!spot) return;
    if (spot.at === 'wall') {
      // a lantern hung from an iron bracket on the house wall, beside the window centred on the joint
      const d = norm2(sub2(VERTS[spot.n], VERTS[v])), k = hash(v, spot.n, 1, 76) < 0.5 ? -0.27 : 0.27;
      const shift = q => [q[0] - d[1] * k, q[1] + d[0] * k];
      const w = shift(l2(VERTS[v], VERTS[spot.n], 0.5)), p = shift(l2(VERTS[v], VERTS[spot.n], 0.4)), Y = GROUND + 0.62;
      rod(bld, [w[0], Y + 0.16, w[1]], [p[0], Y + 0.16, p[1]], 0.008, iron);
      rod(bld, [w[0], Y + 0.04, w[1]], [l2(w, p, 0.55)[0], Y + 0.16, l2(w, p, 0.55)[1]], 0.006, iron);
      boxAt(bld, p[0], p[1], 0.006, Y + 0.1, Y + 0.16, iron);
      boxAt(bld, p[0], p[1], 0.032, Y, Y + 0.1, lin(C.lamp), 'lit');
      boxAt(bld, p[0], p[1], 0.042, Y + 0.1, Y + 0.12, iron);
      return;
    }
    const p = spot.at === 'kerb' ? l2(VERTS[v], VERTS[spot.n], 0.42) : [x, z];
    boxAt(bld, p[0], p[1], 0.03, GROUND, GROUND + 0.07, iron);
    boxAt(bld, p[0], p[1], 0.012, GROUND + 0.07, GROUND + 0.62, iron);
    boxAt(bld, p[0], p[1], 0.036, GROUND + 0.62, GROUND + 0.71, lin(C.lamp), 'lit');
    boxAt(bld, p[0], p[1], 0.046, GROUND + 0.71, GROUND + 0.735, iron);
  },
};
