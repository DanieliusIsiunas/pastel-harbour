import { C } from '../core/palette.js';
import { hash, lin, shade } from '../core/util.js';
import { obstacle, wb, wslab } from '../geom/builder.js';
import { STREETS } from '../plan/analysis.js';

// firewood stacked against a cottage wall under a little lean-to roof
export default {
  kind: 'woodpile', slot: 'overlay',
  rule: { at: (v, y) => y === 1, ctx: c => STREETS(c) || c === 'courtyard', grounded: true, types: ['cottage'],
    max: () => 1, p: () => 0.7, why: 'firewood stacked against a cottage wall' },
  draw(bld, { F, y }) {
    const s0 = Math.max(0.3, F.L * 0.45);
    if (F.L - s0 < 0.22) return;
    const P = s => [F.a[0] + F.t[0] * s + F.n[0] * 0.09, F.a[1] + F.t[1] * s + F.n[1] * 0.09];
    obstacle(bld, P(s0 + 0.03), P(s0 + 0.19), 0.08);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) {
      const tone = hash(Math.round(F.a[0] * 40), r, k, 67);
      wb(bld, F, s0, s0 + 0.2, 0.02 + k * 0.042, 0.058 + k * 0.042, y + r * 0.04, y + r * 0.04 + 0.038, lin(shade('#8a5f3c', 0.85 + tone * 0.3)));
    }
    wslab(bld, F, s0 - 0.02, s0 + 0.22, 0, y + 0.2, 0.16, y + 0.15, 0.015, lin(shade(C.wood, 0.9)));
  },
};
