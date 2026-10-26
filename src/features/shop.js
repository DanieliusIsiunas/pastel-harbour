import { C } from '../core/palette.js';
import { hash, lin, shade } from '../core/util.js';
import { fx } from '../fx/particles.js';
import { blob, frameRing, hole, rod, wb, wslab } from '../geom/builder.js';
import { STREETS } from '../plan/analysis.js';

// a shopfront with a striped awning, crates of produce beside it, and a hanging sign on an iron bracket
export default {
  kind: 'shop', slot: 'side', phase: 'front',
  rule: { at: (v, y) => y === 1, ctx: STREETS, grounded: true, when: h => h.shop, max: () => 9, p: () => 1,
    why: 'a shopfront on a frontage people walk past' },
  draw(bld, { F, y, L, s, cell, lo, hi, trim, lit, house }) {
    if (L <= 0.3) return false;
    // shopfront with a striped awning
    const e = Math.min(L - 0.05, 0.42);
    frameRing(bld, F, 0, e - 0.04, y + 0.14, y + 0.56, 0.04, trim, true);
    hole(bld, F, 0, e - 0.04, y + 0.14, y + 0.56, lit);
    wb(bld, F, 0, e - 0.04, 0, 0.022, y + 0.1, y + 0.14, lin(C.wood));
    const n = Math.max(2, Math.round(e / 0.075)), w = (e + 0.03) / n;
    const stripe = [lin(C.trim), lin(house.awning)];
    for (let i = 0; i < n; i++) wslab(bld, F, i * w, (i + 1) * w, 0, y + 0.74, 0.26, y + 0.62, 0.03, stripe[i & 1]);
    if (L > e + 0.12) {
      // crates of produce stacked beside the shopfront
      const s0 = e + 0.02, crate = lin('#c9a273');
      wb(bld, F, s0, s0 + 0.1, 0.03, 0.15, y, y + 0.09, crate);
      wb(bld, F, s0 + 0.01, s0 + 0.09, 0.05, 0.13, y + 0.09, y + 0.16, lin(shade('#c9a273', 0.9)));
      const fx = F.a[0] + F.t[0] * (s0 + 0.05) + F.n[0] * 0.09, fz = F.a[1] + F.t[1] * (s0 + 0.05) + F.n[1] * 0.09;
      const fruit = ['#e2574c', '#f2b33d', '#8cbf4f'][Math.floor(hash(lo, hi, 2, 55) * 3)];
      for (const [dx, dz] of [[-0.02, -0.02], [0.02, 0.01], [-0.01, 0.025]]) blob(bld, fx + dx, y + 0.175, fz + dz, 0.022, 0.02, 0.022, fruit);
    }
    if (L > e + 0.1 && cell.i < cell.nb[s.k]) {
      // a blade sign sticking out past the awning, so it reads from along the street; drawn by one half of
      // the joint only. Its emblem says what the shop sells: a loaf, a fish or a bottle
      const sx = e + 0.07, iron = lin('#4a5058'), Y = y + 0.9, P = (sd, d, yy) => [F.a[0] + F.t[0] * sd + F.n[0] * d, yy, F.a[1] + F.t[1] * sd + F.n[1] * d];
      wb(bld, F, sx - 0.01, sx + 0.01, 0, 0.3, Y, Y + 0.016, iron);
      rod(bld, P(sx, 0, Y - 0.12), P(sx, 0.18, Y), 0.006, iron);
      for (const d of [0.1, 0.26]) wb(bld, F, sx - 0.003, sx + 0.003, d - 0.003, d + 0.003, Y - 0.03, Y, iron);
      wb(bld, F, sx - 0.008, sx + 0.008, 0.08, 0.28, Y - 0.2, Y - 0.03, lin(house.awning));
      wb(bld, F, sx - 0.011, sx + 0.011, 0.075, 0.285, Y - 0.035, Y - 0.025, trim);
      wb(bld, F, sx - 0.011, sx + 0.011, 0.075, 0.285, Y - 0.205, Y - 0.195, trim);
      const sign = Math.floor(hash(lo, hi, 3, 55) * 3), gold = lin(C.gold);
      if (sign === 0) wb(bld, F, sx - 0.012, sx + 0.012, 0.13, 0.23, Y - 0.15, Y - 0.08, gold);
      else if (sign === 1) { wb(bld, F, sx - 0.012, sx + 0.012, 0.12, 0.21, Y - 0.13, Y - 0.1, gold); wb(bld, F, sx - 0.012, sx + 0.012, 0.21, 0.24, Y - 0.145, Y - 0.085, gold); }
      else { wb(bld, F, sx - 0.012, sx + 0.012, 0.16, 0.2, Y - 0.17, Y - 0.1, gold); wb(bld, F, sx - 0.012, sx + 0.012, 0.172, 0.188, Y - 0.1, Y - 0.06, gold); }
    }
    return true;
  },
};
