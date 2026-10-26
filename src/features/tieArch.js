import { C } from '../core/palette.js';
import { lin, shade } from '../core/util.js';
import { wb } from '../geom/builder.js';
import { SPAN_CTX, spanKind, spanFrame, spanOf } from './span.js';

// a stone tie arch between two houses across a narrow lane, at the first floor line: the buttress arches of
// old Mediterranean towns that keep facing walls from leaning apart
export default {
  kind: 'tieArch', slot: 'node',
  rule: { ctx: SPAN_CTX, needs: v => spanKind(v) === 'tieArch', group: 'span', spacing: 2.2, p: 1,
    why: 'an arch bracing two facing walls across a narrow lane' },
  draw(bld, { v }) {
    const sp = spanOf(v);
    if (!sp) return;
    const F = spanFrame(sp), W = sp.width, D = 0.1, spring = 1.83, crown = 2.13, top = 2.24;
    const stone = lin('#d8c7a6'), lip = lin(C.stoneLip), N = 12;
    bld.kind = 3;
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N, um = (u0 + u1) / 2;
      // a round-ish arch: the underside rises quickly from the walls and flattens at the crown
      const under = spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - (2 * um - 1) ** 2));
      const e0 = k === 0 ? -0.06 : 0, e1 = k === N - 1 ? 0.06 : 0;
      wb(bld, F, u0 * W + e0, u1 * W + e1, -D, D, under, top, k % 2 ? stone : lin(shade('#d8c7a6', 0.95)));
    }
    bld.kind = 0;
    wb(bld, F, -0.06, W + 0.06, -D - 0.015, D + 0.015, top, top + 0.035, lip);
  },
};
