import { EDGE, GROUND } from '../core/dims.js';
import { VERTS, cells, vAdj, vCells } from '../core/grid.js';
import { has, topOf } from '../core/model.js';
import { hash, l2, lin, norm2, outward, sub2 } from '../core/util.js';
import { boxAt, obstacle, rod, spot } from '../geom/builder.js';
import { fishingBoat } from '../geom/boats.js';
import { PLAN } from '../plan/planner.js';

// A fishing boat lies alongside the quay only where it can come and go: the water off the edge and every
// tile around it hold nothing, so the quay looks out on open water rather than into a narrow canal. It keeps
// clear of the water stairs, whose rowboats lie along the quay too.
const empty = u => !has(u, 0) && topOf(u) === 0;
const shared = (v, n) => vCells[v].map(([ci]) => ci).filter(ci => vCells[n].some(([cj]) => cj === ci));
const mid = (v, n) => l2(VERTS[v], VERTS[n], 0.5);
const nearStairs = (v, n) => [...PLAN.edge].some(([key, e]) => e.kind === 'waterStairs'
  && Math.hypot(...sub2(mid(...key.split('~').map(Number)), mid(v, n))) < 1.4);
export const openWater = (v, n) => empty(n) && vAdj[n].every(u => u === v || empty(u)) && shared(v, n).length === 2;
// where the boat lies: along the quay face (which runs from one cell centre through the edge's midpoint to
// the other), its side a hand's width off the stone
export function berth(v, n) {
  const m = mid(v, n), d = norm2(sub2(VERTS[n], VERTS[v])), cs = shared(v, n).map(ci => cells[ci].c);
  const t = norm2(sub2(cs[1], cs[0])), reach = Math.max(0, ...cs.map(c => (c[0] - m[0]) * d[0] + (c[1] - m[1]) * d[1])) * 0.8;
  const off = EDGE + 0.04 + 0.17 + reach;
  return { m, d, t, cs, at: [m[0] + d[0] * off, m[1] + d[1] * off] };
}
export default {
  kind: 'fishingBoat', slot: 'edge', clearsEdge: true,
  rule: { spacing: 4.5, p: 0.8, opens: true, needs: (v, n) => openWater(v, n) && !nearStairs(v, n),
    why: 'a fishing boat moored where the quay looks out on open water' },
  check: (v, n) => (openWater(v, n) ? null : 'fishing boat moored without open water around it'),
  draw(bld, { v, n }) {
    const B = berth(v, n), bow = hash(v, n, 0, 134) < 0.5 ? B.t : [-B.t[0], -B.t[1]];
    // which side of the boat faces the quay: its frame's z axis is the bow direction turned left
    const quay = -B.d[0] * -bow[1] + -B.d[1] * bow[0] > 0 ? 1 : -1;
    const ends = fishingBoat(bld, B.at[0], B.at[1], bow, quay, [v, n]);
    // a bollard on the quay at each end of the berth, the boat's lines made fast to them
    const iron = lin('#3b4148'), line = lin('#c8b48a');
    // the middle of the berth, where the crew stands to work on the boat
    spot(bld, 'mooring', v, [B.m[0] - B.d[0] * 0.17, B.m[1] - B.d[1] * 0.17], B.d, GROUND, { crew: true });
    for (const c of B.cs) {
      const p = l2(B.m, c, 0.5), inn = outward(B.m, c, VERTS[n]), q = [p[0] + inn[0] * 0.09, p[1] + inn[1] * 0.09];
      obstacle(bld, q, q, 0.04);
      boxAt(bld, q[0], q[1], 0.03, GROUND, GROUND + 0.1, iron);
      boxAt(bld, q[0], q[1], 0.04, GROUND + 0.1, GROUND + 0.125, iron);
      const e = ends.slice().sort((a, b) => Math.hypot(a[0] - q[0], a[2] - q[1]) - Math.hypot(b[0] - q[0], b[2] - q[1]))[0];
      rod(bld, [q[0], GROUND + 0.11, q[1]], e, 0.005, line);
    }
  },
};
