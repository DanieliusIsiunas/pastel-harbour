import { face, rod } from '../geom/builder.js';
import { hash, lin } from '../core/util.js';
import { SPAN_CTX, spanKind, catenary, spanOf } from './span.js';

// festive bunting: a line of pennants high across a lane, under the eaves
const FLAGS = ['#e8a3a0', '#f5e6b8', '#9cc5e3', '#a8d5ba', '#c7b3e6', '#f4f1ec', '#e9c46a'];
export default {
  kind: 'bunting', slot: 'node',
  rule: { ctx: SPAN_CTX, needs: v => spanKind(v) === 'bunting', group: 'span', spacing: 1.6, p: 1, why: 'pennants strung high across the lane' },
  draw(bld, { v }) {
    const sp = spanOf(v);
    if (!sp) return;
    const Y = Math.min(sp.top, 4) - 0.14, N = Math.max(5, Math.round(sp.width / 0.085)), pts = catenary(sp, Y, 0.05 + 0.04 * sp.width, N);
    for (let k = 0; k < N; k++) rod(bld, pts[k], pts[k + 1], 0.004, lin('#e9e2d4'));
    const phase = Math.floor(hash(v, 0, 77, 1) * FLAGS.length), ref = [sp.a[0], Y + 3, sp.a[1]];
    for (let k = 0; k < N; k++) {
      const p = pts[k], q = pts[k + 1], tip = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.085, (p[2] + q[2]) / 2];
      const a = [p[0] * 0.92 + q[0] * 0.08, p[1] * 0.92 + q[1] * 0.08 - 0.004, p[2] * 0.92 + q[2] * 0.08];
      const b = [p[0] * 0.08 + q[0] * 0.92, p[1] * 0.08 + q[1] * 0.92 - 0.004, p[2] * 0.08 + q[2] * 0.92];
      const col = lin(FLAGS[(phase + k) % FLAGS.length]);
      face(bld, 'main', [a, b, tip], col, ref);
      face(bld, 'main', [b, a, tip], col, ref);
    }
  },
};
