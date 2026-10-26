import { hash, lin, shade } from '../core/util.js';
import { boxAt } from '../geom/builder.js';
import { STREETS } from '../plan/analysis.js';

// barrels of goods outside a warehouse
export default {
  kind: 'barrels', slot: 'overlay',
  rule: { at: (v, y) => y === 1, ctx: STREETS, grounded: true, types: ['warehouse'], max: () => 2, p: () => 0.8,
    why: 'goods waiting outside a warehouse' },
  draw(bld, { F, y, lo, hi }) {
    const seed = lo * 1000 + hi;
    const s0 = Math.max(0.34, F.L * 0.5);
    if (F.L - s0 < 0.16) return;
    const iron = lin('#3b4148');
    for (let i = 0; i < 2; i++) {
      const sx = s0 + 0.07 + i * 0.15;
      if (sx > F.L - 0.06) break;
      const x = F.a[0] + F.t[0] * sx + F.n[0] * 0.1, z = F.a[1] + F.t[1] * sx + F.n[1] * 0.1, tall = 0.15 + hash(seed, i, 1, 68) * 0.03;
      boxAt(bld, x, z, 0.06, y, y + tall, lin(shade('#9a6b45', 0.9 + 0.2 * hash(seed, i, 2, 68))));
      for (const hy of [0.03, tall - 0.045]) boxAt(bld, x, z, 0.064, y + hy, y + hy + 0.014, iron);
      boxAt(bld, x, z, 0.052, y + tall, y + tall + 0.006, lin(shade('#9a6b45', 0.7)));
    }
  },
};
