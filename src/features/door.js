import { has } from '../core/model.js';
import { C, LEAVES } from '../core/palette.js';
import { hash, lin, shade } from '../core/util.js';
import { blob, hole, wb, wseg, wslab } from '../geom/builder.js';
import { WALKABLE } from '../plan/analysis.js';
import { houseOf, roofOf } from '../plan/houses.js';
import { styleOf } from '../plan/styles.js';

// a door onto walkable ground in the house type's own style, with a lamp and potted shrubs
export default {
  kind: 'door', slot: 'side', phase: 'entry',
  rule: { at: (v, y) => y === 1, ctx: c => WALKABLE.has(c), grounded: true, max: h => (h.cols.length >= 4 ? 2 : 1), p: () => 1,
    onPlace: (h, sd) => h.doors.set(sd.v, sd.n), why: 'opens onto a street, plaza, courtyard or quay' },
  check: (v, n) => (has(n, 0) && !has(n, 1) ? null : 'door into nowhere'),
  draw(bld, { F, y, L, v, lo, hi }) {
    const kind = styleOf(v).door;
    doorway(bld, F, y, L, kind, roofOf(v, y), lo, hi);
    if (kind !== 'barn' && L > 0.33) {
      wb(bld, F, 0.27, 0.32, 0, 0.07, y + 0.52, y + 0.62, lin(C.lamp), 'lit');
      wb(bld, F, 0.285, 0.305, 0, 0.07, y + 0.62, y + 0.66, lin(C.wood));
    }
    const hs = houseOf(v);
    if (hs && hs.planters && L > 0.42) {
      // a potted shrub on each side of the door
      wb(bld, F, 0.31, 0.39, 0.05, 0.13, y, y + 0.12, lin('#b8694c'));
      wb(bld, F, 0.3, 0.4, 0.04, 0.14, y + 0.12, y + 0.14, lin(shade('#b8694c', 0.85)));
      const px = F.a[0] + F.t[0] * 0.35 + F.n[0] * 0.09, pz = F.a[1] + F.t[1] * 0.35 + F.n[1] * 0.09;
      blob(bld, px, y + 0.24, pz, 0.075, 0.1, 0.075, LEAVES[Math.floor(hash(lo, hi, 1, 50) * LEAVES.length)]);
    }
    return true;
  },
};

// a door in the house type's own style; s = 0 is the joint, so each half draws its side
function doorway(bld, F, y, L, kind, roofHex, lo, hi) {
  const trim = lin(C.trim), wood = lin(C.wood), dark = lin(shade(C.wood, 0.7)), iron = lin('#33373d');
  if (kind === 'barn' && L > 0.3) {
    // a wide double plank door with a Z brace, no canopy
    bld.open.push([-0.01, 0.3, y - 0.1, y + 0.9]);
    wb(bld, F, 0, 0.27, 0, 0.03, y + 0.74, y + 0.8, lin(shade(C.wood, 0.8)));
    wb(bld, F, 0.24, 0.27, 0, 0.03, y, y + 0.74, lin(shade(C.wood, 0.8)));
    for (let i = 0; i < 4; i++) wb(bld, F, i * 0.06, i * 0.06 + 0.058, 0, 0.034, y, y + 0.74, i & 1 ? wood : lin(shade(C.wood, 1.12)));
    wseg(bld, F, 0.02, y + 0.12, 0.22, y + 0.6, 0.034, 0.046, 0.04, dark);
    wb(bld, F, 0.01, 0.23, 0.034, 0.046, y + 0.1, y + 0.14, dark);
    wb(bld, F, 0.01, 0.23, 0.034, 0.046, y + 0.58, y + 0.62, dark);
    wb(bld, F, 0, 0.28, 0, 0.12, y, y + 0.03, lin(C.stone));
    return;
  }
  if (kind === 'arched') {
    // a tall round-headed door in a stone surround, with iron straps
    bld.open.push([-0.01, 0.24, y - 0.1, y + 1]);
    const r = 0.13, top = y + 0.66, N = 6;
    wb(bld, F, 0, 0.13, 0, 0.04, y, top, wood);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI / 2, a1 = ((i + 1) / N) * Math.PI / 2;
      const s0 = Math.sin(a0) * r, s1 = Math.sin(a1) * r;
      wb(bld, F, s0, s1, 0, 0.04, top, top + Math.cos(a1) * r, wood);
      wseg(bld, F, s0, top + Math.cos(a0) * (r + 0.05), s1, top + Math.cos(a1) * (r + 0.05), 0, 0.03, 0.05, trim);
    }
    wb(bld, F, r, r + 0.05, 0, 0.03, y, top, trim);
    for (const yy of [y + 0.16, y + 0.48]) wb(bld, F, 0, 0.12, 0.04, 0.05, yy, yy + 0.025, iron);
    wb(bld, F, 0.015, 0.035, 0.04, 0.055, y + 0.32, y + 0.36, iron);
    wb(bld, F, 0, 0.22, 0, 0.16, y, y + 0.05, lin(C.stoneLip));
    return;
  }
  if (kind === 'plank') {
    // a low cottage door of vertical planks under a small pitched hood
    bld.open.push([-0.01, 0.22, y - 0.1, y + 0.85]);
    wb(bld, F, 0, 0.17, 0, 0.025, y, y + 0.66, trim);
    wb(bld, F, 0, 0.13, 0, 0.04, y, y + 0.6, wood);
    for (const sx of [0.045, 0.09]) wb(bld, F, sx, sx + 0.006, 0.04, 0.046, y + 0.02, y + 0.58, dark);
    wb(bld, F, 0.02, 0.05, 0.04, 0.055, y + 0.28, y + 0.33, lin(C.gold));
    wslab(bld, F, 0, 0.22, 0, y + 0.82, 0.2, y + 0.68, 0.03, lin(roofHex));
    wb(bld, F, 0, 0.2, 0, 0.14, y, y + 0.04, lin(C.stone));
    return;
  }
  // panel: a townhouse door with a fanlight above and a canopy
  bld.open.push([-0.01, 0.25, y - 0.1, y + 0.95]);
  wb(bld, F, 0, 0.21, 0, 0.025, y, y + 0.82, trim);
  wb(bld, F, 0, 0.16, 0, 0.04, y, y + 0.64, wood);
  for (const yy of [y + 0.08, y + 0.36]) wb(bld, F, 0.03, 0.13, 0.04, 0.048, yy, yy + 0.22, lin(shade(C.wood, 1.15)));
  wb(bld, F, 0.02, 0.06, 0.048, 0.056, y + 0.3, y + 0.36, lin(C.gold));
  hole(bld, F, 0, 0.15, y + 0.67, y + 0.78, hash(lo, hi, 1, 66) < 0.6 ? 'lit' : 'dark');
  wb(bld, F, 0, 0.011, 0, 0.034, y + 0.67, y + 0.78, trim);
  wslab(bld, F, 0, 0.28, 0, y + 0.92, 0.24, y + 0.83, 0.035, lin(roofHex));
  wb(bld, F, 0, 0.25, 0, 0.17, y, y + 0.05, lin(C.stoneLip));
}
