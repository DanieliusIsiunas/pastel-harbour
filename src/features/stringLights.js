import { boxAt, rod } from '../geom/builder.js';
import { hash, lin } from '../core/util.js';
import { SPAN_CTX, spanKind, catenary, spanOf } from './span.js';

// a string of bulbs looping across a lane: little warm points by day, a glowing garland at night
const BULBS = ['#fff1c4', '#ffd89a', '#ffe9b0'];
export default {
  kind: 'stringLights', slot: 'node',
  rule: { ctx: SPAN_CTX, needs: v => spanKind(v) === 'stringLights', group: 'span', spacing: 1.6, p: 1, why: 'lights strung across the lane for the evening' },
  draw(bld, { v }) {
    const sp = spanOf(v);
    if (!sp) return;
    const Y = Math.min(sp.top, 4) - 0.2, N = Math.max(4, Math.round(sp.width / 0.11)), pts = catenary(sp, Y, 0.12 + 0.06 * sp.width, N);
    const wire = lin('#3d4148');
    for (let k = 0; k < N; k++) rod(bld, pts[k], pts[k + 1], 0.0035, wire);
    for (let k = 1; k < N; k++) {
      const p = pts[k], col = lin(BULBS[Math.floor(hash(v, k, 78, 1) * BULBS.length)]);
      boxAt(bld, p[0], p[2], 0.003, p[1] - 0.025, p[1], wire);
      boxAt(bld, p[0], p[2], 0.013, p[1] - 0.05, p[1] - 0.022, col, 'lit');
    }
  },
};
