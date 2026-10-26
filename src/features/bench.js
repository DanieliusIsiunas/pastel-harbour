import { GROUND } from '../core/dims.js';
import { IRON } from '../core/palette.js';
import { lin, norm2, outward, sub2 } from '../core/util.js';
import { wb } from '../geom/builder.js';

// a bench behind the quay railing, facing the water
export default {
  kind: 'bench', slot: 'edge',
  rule: { spacing: 2.0, p: 0.7, why: 'a seat facing the water' },
  draw(bld, { a, c, Vq, L2 }) {
    const F = { a, t: norm2(sub2(c, a)), n: outward(a, c, Vq), L: L2 }, sc = L2 * 0.5, wood = lin('#9a6b45'), G = GROUND + 0.015;
    wb(bld, F, sc - 0.13, sc + 0.13, -0.21, -0.12, G + 0.1, G + 0.125, wood);
    wb(bld, F, sc - 0.13, sc + 0.13, -0.225, -0.205, G + 0.125, G + 0.25, wood);
    for (const e of [-0.11, 0.1]) wb(bld, F, sc + e, sc + e + 0.015, -0.21, -0.125, G, G + 0.1, IRON);
  },
};
