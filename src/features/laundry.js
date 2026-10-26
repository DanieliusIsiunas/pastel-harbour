import { hash, lin } from '../core/util.js';
import { boxAt, rod, wb } from '../geom/builder.js';
import { SPAN_CTX, spanKind, catenary, spanOf } from './span.js';

// a washing line strung from window to window across a lane: shirts, towels, trousers and socks, each
// pinned with a peg, sagging under their weight
const CLOTH = ['#f4f1ec', '#9cc5e3', '#e8a3a0', '#f5e6b8', '#a8d5ba', '#c7b3e6'];
export default {
  kind: 'laundry', slot: 'node',
  rule: { ctx: SPAN_CTX, needs: v => spanKind(v) === 'laundry', group: 'span', spacing: 1.6, p: 1, why: 'strung between two facing houses' },
  draw(bld, { v }) {
    const sp = spanOf(v);
    if (!sp) return;
    const N = Math.max(4, Math.round(sp.width / 0.14)), pts = catenary(sp, 2.66, 0.07 + 0.05 * sp.width, N);
    const line = lin('#e9e2d4'), peg = lin('#b98f63');
    for (let k = 0; k < N; k++) rod(bld, pts[k], pts[k + 1], 0.005, line);
    for (let k = 1; k < N; k++) {
      const r = j => hash(v, k, 62, j);
      if (r(1) < 0.2) continue;
      const p = pts[k], F = { a: [p[0], p[2]], t: sp.dir, n: sp.nrm, L: 0 }, col = lin(CLOTH[Math.floor(r(4) * CLOTH.length)]), Y = p[1] - 0.004;
      const sway = (r(5) - 0.5) * 0.02, item = r(2);
      if (item < 0.35) {
        // a shirt: body and short sleeves
        wb(bld, F, -0.04, 0.04, -0.004 + sway, 0.004 + sway, Y - 0.12, Y, col);
        wb(bld, F, -0.065, 0.065, -0.004 + sway, 0.004 + sway, Y - 0.04, Y, col);
      } else if (item < 0.6) {
        // trousers: a waistband and two legs
        wb(bld, F, -0.035, 0.035, -0.004, 0.004, Y - 0.03, Y, col);
        wb(bld, F, -0.035, -0.006, -0.004, 0.004, Y - 0.16, Y - 0.03, col);
        wb(bld, F, 0.006, 0.035, -0.004, 0.004, Y - 0.16, Y - 0.03, col);
      } else if (item < 0.85) {
        // a towel folded over the line
        const w = 0.04 + r(3) * 0.03;
        wb(bld, F, -w, w, -0.006, 0.006, Y - 0.1 - r(6) * 0.05, Y + 0.004, col);
      } else {
        // a pair of socks
        for (const o of [-0.022, 0.012]) wb(bld, F, o, o + 0.014, -0.004, 0.004, Y - 0.06, Y, col);
      }
      boxAt(bld, p[0], p[2], 0.006, Y - 0.006, Y + 0.012, peg);
    }
  },
};
