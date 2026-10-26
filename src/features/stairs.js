import { has } from '../core/model.js';
import { C } from '../core/palette.js';
import { lin } from '../core/util.js';
import { hexa, wb, wseg, wslab } from '../geom/builder.js';
import { STREETS, sideKey } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';

// an exterior staircase: the lower half climbs from the street to the joint, the upper half continues
// to a landing and a first-floor door at the far corner (the side it claims, planned as 'stairsTop')
export default {
  kind: 'stairs', aliases: ['stairsTop'], slot: 'side', phase: 'entry',
  rule: { at: (v, y) => y === 1, ctx: STREETS, grounded: true, types: ['townhouse', 'warehouse'], max: () => 1, p: () => 0.5,
    needs: (v, n) => has(v, 2) && !has(n, 2) && !PLAN.side.has(sideKey(v, n, 2)), claims: (v, n) => [sideKey(v, n, 2)],
    why: 'climbs from the street to a first-floor door' },
  check: (v, n, y, kind) => (kind !== 'stairs' || (PLAN.side.get(sideKey(v, n, 2)) === 'stairsTop' && has(n, 0)) ? null
    : 'stairs without a top door or a street'),
  draw(bld, { F, y, L, s, cell, trim, roofHex }) {
    const role = cell.i < cell.nb[s.k] ? 'low' : 'high';
    if (y === 1) { flight(bld, F, role, y); return true; }
    if (role === 'high' && L > 0.3) {
      const s1 = L - 0.03, s0 = s1 - 0.19;
      wb(bld, F, s0 - 0.03, s1 + 0.02, 0, 0.025, y, y + 0.72, trim);
      wb(bld, F, s0, s1, 0, 0.04, y, y + 0.64, lin(C.wood));
      bld.open.push([s0 - 0.06, s1 + 0.05, y - 0.1, y + 0.9]);
      wb(bld, F, s0 + 0.02, s0 + 0.05, 0.04, 0.05, y + 0.3, y + 0.36, lin(C.gold));
      wslab(bld, F, s0 - 0.05, s1 + 0.04, 0, y + 0.82, 0.2, y + 0.73, 0.03, lin(roofHex));
      wb(bld, F, s0 - 0.1, s0 - 0.06, 0, 0.07, y + 0.5, y + 0.6, lin(C.lamp), 'lit');
      return true;
    }
    return false;
  },
};

function flight(bld, F, role, Y0) {
  const L = F.L, low = role === 'low', D = 0.16;
  const tread = lin(C.stoneLip), riser = lin(C.stone), rail = lin(C.trim);
  const land = low ? 0 : Math.min(0.22, L * 0.4), run = L - land;
  const hAt = x => Y0 + (low ? 0.5 * (1 - x) : 0.5 + 0.5 * x);
  const n = Math.max(3, Math.round(run / 0.07));
  for (let i = 0; i < n; i++) {
    const x0 = i / n, x1 = (i + 1) / n, top = low ? hAt(x0) : hAt(x1);
    hexa(bld, 'main', [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0], [1, 0], [1, 1], [0, 1]].map(([si, di], j) => {
      const sx = (si ? x1 : x0) * run, d = di ? D : 0, yy = j < 4 ? Y0 : top;
      return [F.a[0] + F.t[0] * sx + F.n[0] * d, yy, F.a[1] + F.t[1] * sx + F.n[1] * d];
    }), riser, [0.75, 0.75, 0.75, 0.75, 1.15, 1.15, 1.15, 1.15]);
    wb(bld, F, x0 * run, x1 * run, 0, D + 0.01, top - 0.02, top, tread);
  }
  if (!low) {
    wb(bld, F, run, L, 0, D + 0.03, Y0, Y0 + 1, riser);
    wb(bld, F, run - 0.01, L, 0, D + 0.04, Y0 + 0.97, Y0 + 1.01, tread);
    wb(bld, F, run - 0.01, L, D + 0.02, D + 0.04, Y0 + 1.01, Y0 + 1.3, rail);
  }
  // railing: posts and a sloped handrail along the outer edge
  const top0 = hAt(0), top1 = hAt(1);
  for (let i = 0; i <= 3; i++) {
    const x = i / 3, sx = x * run;
    wb(bld, F, sx - 0.008, sx + 0.008, D - 0.02, D - 0.004, hAt(x), hAt(x) + 0.28, rail);
  }
  wseg(bld, F, 0, top0 + 0.27, run, top1 + 0.27, D - 0.024, D, 0.025, rail);
}
