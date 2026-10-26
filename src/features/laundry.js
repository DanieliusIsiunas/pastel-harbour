import { VERTS } from '../core/grid.js';
import { hash, lin, norm2, sub2 } from '../core/util.js';
import { rod, wb } from '../geom/builder.js';
import { lanePair } from '../plan/analysis.js';

// a washing line strung across a lane between two facing tall houses
export default {
  kind: 'laundry', slot: 'node',
  rule: { ctx: k => k === 'lane', needs: v => !!lanePair(v), spacing: 1.6, p: 0.75, why: 'strung between two facing houses' },
  draw(bld, { v }) {
    const pair = lanePair(v);
    if (!pair) return;
    const [pa, pb] = pair.map(n => VERTS[n]), dir = norm2(sub2(pb, pa)), span = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    if (span - 0.92 < 0.3) return;
    const Y = 2.62, a3 = [pa[0] + dir[0] * 0.46, Y, pa[1] + dir[1] * 0.46], b3 = [pb[0] - dir[0] * 0.46, Y, pb[1] - dir[1] * 0.46];
    const N = 6, pts = [];
    for (let k = 0; k <= N; k++) { const u = k / N; pts.push([a3[0] + (b3[0] - a3[0]) * u, Y - 0.36 * u * (1 - u), a3[2] + (b3[2] - a3[2]) * u]); }
    for (let k = 0; k < N; k++) rod(bld, pts[k], pts[k + 1], 0.005, lin('#e9e2d4'));
    const cloths = ['#f4f1ec', '#9cc5e3', '#e8a3a0', '#f5e6b8', '#a8d5ba'];
    for (let k = 1; k < N; k++) {
      if (hash(v, k, 62, 1) < 0.25) continue;
      const p = pts[k], w = 0.05 + hash(v, k, 62, 2) * 0.04, hgt = 0.1 + hash(v, k, 62, 3) * 0.08;
      wb(bld, { a: [p[0], p[2]], t: dir, n: [-dir[1], dir[0]], L: 0 }, -w, w, -0.004, 0.004, p[1] - hgt, p[1] - 0.004, lin(cloths[Math.floor(hash(v, k, 62, 4) * cloths.length)]));
    }
  },
};
