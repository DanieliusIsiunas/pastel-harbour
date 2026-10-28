import { GROUND, WATER } from '../core/dims.js';
import { C } from '../core/palette.js';
import { lin, norm2, outward, shade, sub2 } from '../core/util.js';
import { boxAt, obstacle, rod, spot, wb } from '../geom/builder.js';
import { ownerOf, skiff } from '../geom/boats.js';

// stone steps running down the face of the quay into the harbour, with a mooring bollard and the rowboat of
// the house nearest the steps
export default {
  kind: 'waterStairs', slot: 'edge', replacesRailing: true,
  rule: { spacing: 3.2, p: 0.7, opens: true, why: 'steps down to a moored rowboat' },
  draw(bld, { a, c, Vq: inside, v }) {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 0.3) return;
    const F = { a, t: norm2(sub2(c, a)), n: outward(a, c, inside), L };
    const n = 5, run = Math.min(L * 0.85, 0.5), drop = GROUND - WATER + 0.02;
    for (let j = 0; j < n; j++) {
      const top = GROUND - ((j + 1) / n) * drop;
      wb(bld, F, (j / n) * run, ((j + 1) / n) * run + 0.002, 0, 0.17, WATER - 0.3, top, lin(j & 1 ? C.stone : shade(C.stone, 0.94)));
      wb(bld, F, (j / n) * run, ((j + 1) / n) * run, 0, 0.175, top - 0.015, top, lin(C.stoneLip));
    }
    wb(bld, F, run, run + 0.04, 0, 0.17, WATER - 0.3, GROUND + 0.02, lin(C.stoneLip));
    const iron = lin('#3b4148');
    const bx = F.a[0] + F.t[0] * (run + 0.12) - F.n[0] * 0.08, bz = F.a[1] + F.t[1] * (run + 0.12) - F.n[1] * 0.08;
    obstacle(bld, [bx, bz], [bx, bz], 0.04);
    // the top of the steps, where the owner stands to look the boat over
    spot(bld, 'mooring', v, [F.a[0] + F.t[0] * run * 0.45 - F.n[0] * 0.13, F.a[1] + F.t[1] * run * 0.45 - F.n[1] * 0.13], F.n, GROUND);
    boxAt(bld, bx, bz, 0.03, GROUND, GROUND + 0.1, iron);
    boxAt(bld, bx, bz, 0.04, GROUND + 0.1, GROUND + 0.125, iron);
    // the reason for the stairs: a rowboat tied up alongside, its painter rope looped over the bollard
    const ox = F.a[0] + F.t[0] * (run + 0.18) + F.n[0] * 0.32, oz = F.a[1] + F.t[1] * (run + 0.18) + F.n[1] * 0.32;
    const bow = skiff(bld, ox, oz, [-F.t[0], -F.t[1]], ownerOf(v), Math.round(ox * 31 + oz * 17));
    rod(bld, [bx, GROUND + 0.11, bz], bow, 0.006, lin('#c8b48a'));
  },
};
