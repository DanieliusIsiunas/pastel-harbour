import { has } from '../core/model.js';
import { C } from '../core/palette.js';
import { lin } from '../core/util.js';
import { hexa, obstacle, wb, wseg, wslab } from '../geom/builder.js';
import { jointHalf } from '../geom/rules.js';
import { STREETS, sideKey } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';

// an exterior staircase: the lower half climbs from the street to the joint, the upper half continues
// to a landing and a first-floor door at the far corner (the side it claims, planned as 'stairsTop')
export default {
  kind: 'stairs', aliases: ['stairsTop'], slot: 'side', phase: 'entry',
  rule: { at: (v, y) => y === 1, ctx: STREETS, grounded: true, types: ['townhouse', 'warehouse'], max: () => 1, p: () => 0.5,
    // a flight needs a straight run of wall on both halves of the joint, on both floors
    needs: (v, n) => has(v, 2) && !has(n, 2) && !PLAN.side.has(sideKey(v, n, 2)) && jointHalf(v, n, 1) >= 0.32 && jointHalf(v, n, 2) >= 0.32, claims: (v, n) => [sideKey(v, n, 2)],
    why: 'climbs from the street to a first-floor door' },
  check: (v, n, y, kind) => (kind !== 'stairs' || (PLAN.side.get(sideKey(v, n, 2)) === 'stairsTop' && has(n, 0)) ? null
    : 'stairs without a top door or a street'),
  draw(bld, { F, y, L, s, cell, trim, roofHex }) {
    const role = cell.i < cell.nb[s.k] ? 'low' : 'high';
    if (y === 1) {
      obstacle(bld, [F.a[0] + F.n[0] * 0.08, F.a[1] + F.n[1] * 0.08], [F.a[0] + F.t[0] * F.L + F.n[0] * 0.08, F.a[1] + F.t[1] * F.L + F.n[1] * 0.08], 0.09);
      flight(bld, F, role, y);
      return true;
    }
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

// One half of the flight. The steps are solid masonry against the wall, closed on the open side by a sloped
// stringer wall with a coping, so the side reads as one clean line rather than a stack of blocks. The upper
// half ends in a landing carried on an arch between two slim piers.
function flight(bld, F, role, Y0) {
  const L = F.L, low = role === 'low', D = 0.16, S = 0.035;
  const tread = lin(C.stoneLip), stone = lin(C.stone);
  const land = low ? 0 : Math.min(0.22, L * 0.4), run = L - land;
  const hAt = x => Y0 + (low ? 0.5 * (1 - x) : 0.5 + 0.5 * x);
  const P = (sx, d, yy) => [F.a[0] + F.t[0] * sx + F.n[0] * d, yy, F.a[1] + F.t[1] * sx + F.n[1] * d];
  const n = Math.max(3, Math.round(run / 0.07));
  bld.kind = 3;
  for (let i = 0; i < n; i++) {
    const x0 = i / n, x1 = (i + 1) / n, top = low ? hAt(x0) : hAt(x1);
    // the step's body stops just under its tread, so the two tops never share a plane
    hexa(bld, 'main', [P(x0 * run, 0, Y0), P(x1 * run, 0, Y0), P(x1 * run, D, Y0), P(x0 * run, D, Y0),
      P(x0 * run, 0, top - 0.004), P(x1 * run, 0, top - 0.004), P(x1 * run, D, top - 0.004), P(x0 * run, D, top - 0.004)],
      stone, [0.75, 0.75, 0.75, 0.75, 1.1, 1.1, 1.1, 1.1]);
    wb(bld, F, x0 * run, x1 * run, 0, D - 0.004, top - 0.02, top, tread);
    // the stringer: a wall on the open side whose top follows the slope
    const s0 = hAt(x0) + 0.07, s1 = hAt(x1) + 0.07;
    hexa(bld, 'main', [P(x0 * run, D, Y0), P(x1 * run, D, Y0), P(x1 * run, D + S, Y0), P(x0 * run, D + S, Y0),
      P(x0 * run, D, s0), P(x1 * run, D, s1), P(x1 * run, D + S, s1), P(x0 * run, D + S, s0)], stone, [0.8, 0.8, 0.8, 0.8, 1, 1, 1, 1]);
  }
  bld.kind = 0;
  wseg(bld, F, 0, hAt(0) + 0.07, run, hAt(1) + 0.07, D - 0.012, D + S + 0.012, 0.022, tread);
  if (!low) {
    // the landing on an arch between two slim piers
    const pier = 0.045, top = Y0 + 0.97, spring = Y0 + 0.6, crown = Y0 + 0.82, N = 8, w = L - run - 2 * pier;
    bld.kind = 3;
    wb(bld, F, run, run + pier, 0, D + S, Y0, top, stone);
    wb(bld, F, L - pier, L, 0, D + S, Y0, top, stone);
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N, um = (u0 + u1) / 2, under = spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - (2 * um - 1) ** 2));
      wb(bld, F, run + pier + u0 * w, run + pier + u1 * w, 0, D + S, under, top, stone);
    }
    bld.kind = 0;
    wb(bld, F, run - 0.01, L, 0, D + S + 0.012, top, top + 0.04, tread);
    wb(bld, F, run - 0.01, L, D + S - 0.012, D + S + 0.012, top + 0.04, top + 0.12, tread);
  }
  // a slim iron handrail on posts along the stringer
  const iron = lin('#4a5058');
  for (let i = 0; i <= 3; i++) {
    const x = i / 3, sx = x * run;
    wb(bld, F, sx - 0.006, sx + 0.006, D + 0.004, D + 0.016, hAt(x) + 0.09, hAt(x) + 0.3, iron);
  }
  wseg(bld, F, 0, hAt(0) + 0.3, run, hAt(1) + 0.3, D + 0.002, D + 0.018, 0.014, iron);
}
