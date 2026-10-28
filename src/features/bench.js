import { GROUND } from '../core/dims.js';
import { IRON } from '../core/palette.js';
import { lin, norm2, outward, sub2 } from '../core/util.js';
import { obstacle, spot, wb } from '../geom/builder.js';
import { WALK } from '../plan/analysis.js';

// a bench behind the quay railing, facing the water, never in front of a door or at the top of a water stair
export default {
  kind: 'bench', slot: 'edge',
  rule: { spacing: 2.0, p: 0.7, needs: v => !WALK.front.has(v), why: 'a seat facing the water' },
  check: v => (WALK.front.has(v) ? 'bench in front of a door or stair' : null),
  draw(bld, { a, c, Vq, L2, v }) {
    const F = { a, t: norm2(sub2(c, a)), n: outward(a, c, Vq), L: L2 }, sc = L2 * 0.5, wood = lin('#9a6b45'), G = GROUND + 0.015;
    // a seat to watch the water from, come at round the end of the bench nearer the tile's open middle
    const P = (s, d) => [a[0] + F.t[0] * s + F.n[0] * d, a[1] + F.t[1] * s + F.n[1] * d];
    const ends = [P(sc - 0.25, -0.15), P(sc + 0.25, -0.15)].sort((p, q) => Math.hypot(...sub2(p, Vq)) - Math.hypot(...sub2(q, Vq)));
    obstacle(bld, P(sc - 0.1, -0.17), P(sc + 0.1, -0.17), 0.065);
    spot(bld, 'bench', v, P(sc, -0.165), F.n, G + 0.125, { via: ends[0] });
    wb(bld, F, sc - 0.13, sc + 0.13, -0.21, -0.12, G + 0.1, G + 0.125, wood);
    wb(bld, F, sc - 0.13, sc + 0.13, -0.225, -0.205, G + 0.125, G + 0.25, wood);
    for (const e of [-0.11, 0.1]) wb(bld, F, sc + e, sc + e + 0.015, -0.21, -0.125, G, G + 0.1, IRON);
  },
};
