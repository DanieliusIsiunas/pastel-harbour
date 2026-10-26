import { has } from '../core/model.js';
import { LEAVES } from '../core/palette.js';
import { hash } from '../core/util.js';
import { blob } from '../geom/builder.js';

// ivy grows as vines from a few roots at the foot of the wall: each climbs with a gentle sway,
// branches now and then, thins toward the top, and stops at windows and at the building's height
export default {
  kind: 'ivy', slot: 'overlay',
  rule: { at: (v, y) => y === 1, ctx: c => c === 'courtyard' || c === 'plaza' || c === 'lane' || c === 'quay', grounded: true,
    when: h => h.ivy, max: () => 3, p: () => 0.7, why: 'climbs a quiet wall from the ground' },
  draw(bld, { F, y, v, lo, hi }) {
    // ivy grows as vines from a few roots at the foot of the wall: each climbs with a gentle sway,
    // branches now and then, thins toward the top, and stops at windows and at the building's height
    const reach = has(v, 2) ? (has(v, 3) ? 2.3 : 1.65) : 0.82;
    const roots = 1 + Math.floor(hash(lo, hi, 0, 56) * Math.max(1, F.L / 0.22));
    for (let r = 0; r < roots; r++) {
      // roots go in the gaps between windows and doors
      const clearAt = sx => !bld.open.some(o => sx > o[0] - 0.03 && sx < o[1] + 0.03);
      let s0 = -1;
      for (let t = 0; t < 8 && s0 < 0; t++) { const c = 0.05 + hash(lo, hi, r * 8 + t, 57) * Math.max(0.01, F.L - 0.1); if (clearAt(c)) s0 = c; }
      if (s0 < 0) continue;
      const H = reach * (0.55 + 0.45 * hash(lo, hi, r, 58));
      const steps = Math.floor(H / 0.04), ph = hash(lo, hi, r, 59) * 6.28;
      for (let k = 0; k < steps; k++) {
        const yy = 0.03 + k * 0.04, u = k / steps;
        const lean = (hash(lo, hi, r, 63) - 0.5) * 0.5 * u;   // vines drift sideways as they climb
        let sx = Math.min(F.L - 0.02, Math.max(0.02, s0 + Math.sin(yy * 3.2 + ph) * (0.03 + 0.06 * u) + lean));
        // a window in the way: the vine steers around its nearer edge instead of stopping
        const block = bld.open.find(o => sx > o[0] && sx < o[1] && y + yy > o[2] && y + yy < o[3]);
        if (block) {
          const left = block[0] - 0.03, right = block[1] + 0.03;
          sx = Math.abs(sx - left) < Math.abs(right - sx) ? left : right;
          if (sx < 0.02 || sx > F.L - 0.02) break;
        }
        const rad = 0.052 * (1 - 0.5 * u) + 0.014, leaf = LEAVES[Math.floor(hash(lo, hi, r * 97 + k, 60) * LEAVES.length)];
        const x = F.a[0] + F.t[0] * sx + F.n[0] * 0.028, z = F.a[1] + F.t[1] * sx + F.n[1] * 0.028;
        blob(bld, x, y + yy, z, rad, rad * 0.9, rad * 0.42, leaf, F);
        // side shoots fan wider with height; the foot of the vine is a bushy clump
        const shoots = k < 3 ? 2 : (k % 2 === 1 && u < 0.85 ? 1 : 0);
        for (let b2 = 0; b2 < shoots; b2++) {
          const side = (k < 3 ? (b2 ? 1 : -1) : (hash(lo, hi, r * 31 + k, 61) < 0.5 ? -1 : 1));
          const bx = Math.min(F.L - 0.02, Math.max(0.02, sx + side * (0.05 + 0.08 * u + 0.03 * hash(lo, hi, k, 64))));
          const x2 = F.a[0] + F.t[0] * bx + F.n[0] * 0.026, z2 = F.a[1] + F.t[1] * bx + F.n[1] * 0.026;
          blob(bld, x2, y + yy + 0.015, z2, rad * 0.75, rad * 0.7, rad * 0.38, LEAVES[(Math.floor(hash(lo, hi, k, 65) * 5))], F);
        }
      }
    }
  },
};
