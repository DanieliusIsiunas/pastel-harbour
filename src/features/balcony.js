import { has } from '../core/model.js';
import { BLOOMS, LEAVES } from '../core/palette.js';
import { hash, lin } from '../core/util.js';
import { blob, wb, wslab } from '../geom/builder.js';

// a french window opening onto a balcony with a railing and a potted plant
export default {
  kind: 'balcony', slot: 'side', phase: 'window',
  rule: { at: (v, y) => y >= 2, ctx: c => c === 'over-street' || c === 'over-water', when: h => h.balcony > 0,
    max: h => h.cols.length + 1, p: h => h.balcony * 1.6, why: 'looks out over open space' },
  check: (v, n, y) => (has(n, y) ? 'balcony against a wall' : null),
  draw(bld, { F, y, lo, hi, trim, jointWindow }) {
    // french window with a balcony
    jointWindow(0.1, 0.03, 0.82);
    wslab(bld, F, 0, 0.3, 0, y + 0.02, 0.22, y + 0.02, 0.035, trim);
    if (hash(lo, hi, y, 52) < 0.7) {
      wb(bld, F, 0.2, 0.26, 0.08, 0.14, y + 0.055, y + 0.13, lin('#b8694c'));
      const bx = F.a[0] + F.t[0] * 0.23 + F.n[0] * 0.11, bz = F.a[1] + F.t[1] * 0.23 + F.n[1] * 0.11;
      blob(bld, bx, y + 0.17, bz, 0.05, 0.05, 0.05, LEAVES[Math.floor(hash(lo, hi, y, 53) * 5)]);
      blob(bld, bx, y + 0.21, bz, 0.025, 0.025, 0.025, BLOOMS[Math.floor(hash(lo, hi, y, 54) * BLOOMS.length)]);
    }
    wb(bld, F, 0, 0.3, 0.2, 0.22, y + 0.27, y + 0.29, trim);
    wb(bld, F, 0.28, 0.3, 0, 0.22, y + 0.27, y + 0.29, trim);
    for (const sx of [0.03, 0.09, 0.15, 0.21, 0.28]) wb(bld, F, sx, sx + 0.012, 0.2, 0.212, y + 0.055, y + 0.27, trim);
    for (const d of [0.06, 0.13]) wb(bld, F, 0.288, 0.3, d, d + 0.012, y + 0.055, y + 0.27, trim);
    return true;
  },
};
