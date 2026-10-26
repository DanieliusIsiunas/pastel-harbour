import * as THREE from 'three';
import { ARCH, DROP, GROUND, OVER, RISE, RT, WATER } from '../core/dims.js';
import { lowPower } from '../core/env.js';
import { UVM, cells, nx4, pv4, vCells, xz } from '../core/grid.js';
import { blocks, has, keyOf, topOf } from '../core/model.js';
import { C, IRON, IRON2, PALETTE, ROOF_OF, SHUTTERS } from '../core/palette.js';
import { P3, hash, l2, lin, norm2, outward, shade, sub2 } from '../core/util.js';
import { band, boxAt, brickRows, face, frameRing, hexa, hole, pickQuad, pickTri, wb, wseg } from './builder.js';
import { emitGroundCell, railing } from './ground.js';
import { apexOf, isGable, isLighthouse, isStilted, isolated, jointHalf, onStreet, roundOf, supportBase, toneOf } from './rules.js';
import { houseOf, roofOf } from '../plan/houses.js';
import { PLAN } from '../plan/planner.js';
import { sideKey } from '../plan/analysis.js';
import { styleOf } from '../plan/styles.js';
import { feature } from '../features/index.js';

export function emitCellLevel(bld, ci, y) {
  if (y === 0) { emitGroundCell(bld, ci); return; }
  const cell = cells[ci], vv = cell.v;
  const f = vv.map(v => has(v, y));
  if (!f.some(Boolean)) return;
  const sup = vv.map(v => has(v, y - 1));
  const fa = vv.map(v => has(v, y + 1));
  const Cm = xz(cell, 0.5, 0.5), Mp = UVM.map(m => xz(cell, m[0], m[1])), Vp = cell.q;
  const Qc = [0, 1, 2, 3].map(q => [(Vp[q][0] + Mp[q][0] + Cm[0] + Mp[pv4(q)][0]) / 4, (Vp[q][1] + Mp[q][1] + Cm[1] + Mp[pv4(q)][1]) / 4]);
  const all4 = f.every(Boolean);
  const convex = q => f[q] && !f[nx4(q)] && !f[pv4(q)];
  const wallAt = k => f[k] !== f[nx4(k)];
  const rc = q => roundOf(vv[q], y);
  const trimP = k => convex(k) ? l2(Cm, Mp[k], rc(k)) : convex(nx4(k)) ? l2(Cm, Mp[k], rc(nx4(k))) : Cm;

  // walls: straight half-walls on the cell's midlines, plus rounded corners
  const segs = [];
  for (let k = 0; k < 4; k++) if (wallAt(k)) {
    const own = f[k] ? k : nx4(k), a = Mp[k], b = trimP(k);
    segs.push({ a, b, own, k, curve: false, c0: Cm, n: outward(a, b, Qc[own]) });
  }
  const curves = {};
  for (let q = 0; q < 4; q++) if (convex(q)) {
    const A = l2(Cm, Mp[q], rc(q)), B = l2(Cm, Mp[pv4(q)], rc(q)), pts = [], N = 6;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      pts.push([a * A[0] + b * Cm[0] + c * B[0], a * A[1] + b * Cm[1] + c * B[1]]);
    }
    curves[q] = pts;
    for (let i = 0; i < N; i++) segs.push({ a: pts[i], b: pts[i + 1], own: q, curve: true, n: outward(pts[i], pts[i + 1], Qc[q]) });
  }
  // eave/quay offset at the cell centre: mitre of the straight walls meeting there
  const cm = [0, 0];
  const straight = segs.filter(s => !s.curve && s.b === Cm);
  for (const s of straight) { cm[0] += s.n[0]; cm[1] += s.n[1]; }
  const cmu = norm2(cm);
  const cmag = straight.length ? 1 / Math.max(0.55, cmu[0] * straight[0].n[0] + cmu[1] * straight[0].n[1]) : 0;
  const cOff = [cmu[0] * cmag, cmu[1] * cmag];
  const mInfo = k => {
    const e = wallAt(k);
    let off = [0, 0];
    if (e) { const fil = f[k] ? k : nx4(k), emp = f[k] ? nx4(k) : k; off = norm2(sub2(Vp[emp], Vp[fil])); }
    return { p: Mp[k], e, off };
  };
  const gab = (r, q, u) => ({ ...r, g: r.e && isGable(vv[q], y, u) });
  const ringOf = q => {
    const R = [gab(mInfo(q), q, vv[nx4(q)])];
    if (curves[q]) {
      const pts = curves[q];
      for (let i = 0; i < pts.length; i++) R.push({ p: pts[i], e: true, cv: true, off: outward(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)], Qc[q]) });
    } else R.push({ p: Cm, e: !all4, off: cOff });
    R.push(gab(mInfo(pv4(q)), q, vv[pv4(q)]));
    return R;
  };

  for (let q = 0; q < 4; q++) {
    if (!f[q]) continue;
    const v = vv[q], key = keyOf(v, y), b = blocks.get(key);
    const R = ringOf(q), Vq = Vp[q];
    if (!sup[q]) {
      const stilt = isStilted(v, y), ceil = lin(stilt ? IRON2 : shade(b.c, 0.55)), cy = stilt ? y - 0.1 : y + ARCH;
      for (let i = 0; i < R.length - 1; i++) face(bld, 'main', [P3(Vq, cy), P3(R[i].p, cy), P3(R[i + 1].p, cy)], ceil, P3(Vq, y + 5));
      for (let i = 0; i < R.length - 1; i++) pickTri(bld, P3(Vq, y), P3(R[i].p, y), P3(R[i + 1].p, y), { v, y, t: 'bottom' });
      const under = feature.get(PLAN.node.get(v));
      if (y === 1 && !stilt && under && under.slot === 'boathouse' && vCells[v][0][0] === ci) under.draw(bld, { v, x: Vq[0], z: Vq[1] });
    }
    if (!fa[q]) {
      emitRoof(bld, ci, q, y, v, b, R, Vq);
      // the click target follows the roof slopes so clicking a visible roof stacks a floor
      const HV = apexOf(v, y), hOf = r => (r.e && !r.g) ? y + 1 : y + 1 + RISE;
      for (let i = 0; i < R.length - 1; i++) pickTri(bld, P3(Vq, HV), P3(R[i].p, hOf(R[i])), P3(R[i + 1].p, hOf(R[i + 1])), { v, y, t: 'top' });
    }
  }

  for (const s of segs) {
    const v = vv[s.own], key = keyOf(v, y);
    emitWall(bld, cell, y, s, v, blocks.get(key), sup[s.own], vv, cell);
    const cands = s.curve ? [vv[nx4(s.own)], vv[pv4(s.own)]] : [f[s.k] ? vv[nx4(s.k)] : vv[s.k]];
    pickQuad(bld, P3(s.a, y), P3(s.b, y), P3(s.b, y + 1), P3(s.a, y + 1), { v, y, t: 'side', cands });
  }
  // a drainpipe marks the seam where two different houses meet along one straight facade
  const meet = segs.filter(sg => !sg.curve && sg.b === Cm);
  if (meet.length === 2 && meet.every(sg => sup[sg.own])) {
    const [s1, s2] = meet, va = vv[s1.own], vb = vv[s2.own];
    if (houseOf(va) !== houseOf(vb) && blocks.get(keyOf(va, y)).c !== blocks.get(keyOf(vb, y)).c) {
      const p = [Cm[0] + cOff[0] * 0.035, Cm[1] + cOff[1] * 0.035], pipe = lin('#69727b');
      const y0 = onStreet(va, y) ? y : y - 0.02, topLevel = !has(va, y + 1) && !has(vb, y + 1);
      boxAt(bld, p[0], p[1], 0.018, y0, y + (topLevel ? 0.86 : 1), pipe);
      for (const yy of [y + 0.3, y + 0.75]) boxAt(bld, p[0], p[1], 0.026, yy, yy + 0.03, pipe);
      if (topLevel) boxAt(bld, p[0], p[1], 0.04, y + 0.84, y + 0.93, pipe);
      if (y0 === y && onStreet(va, y)) boxAt(bld, p[0] + cOff[0] * 0.03, p[1] + cOff[1] * 0.03, 0.03, y, y + 0.04, pipe);
    }
  }
  // a supported room next to an arcade shows its wall down into the arch
  for (let k = 0; k < 4; k++) {
    if (!f[k] || !f[nx4(k)] || sup[k] === sup[nx4(k)]) continue;
    const own = sup[k] ? k : nx4(k), v = vv[own], key = keyOf(v, y);
    const n = outward(Mp[k], Cm, Qc[own]), col = lin(blocks.get(key).c, toneOf(v, y) * 0.9);
    const mid = l2(Mp[k], Cm, 0.5);
    // set 2 mm back from the wall plane it meets, so the two never share a plane
    const a = [Mp[k][0] - n[0] * 0.002, Mp[k][1] - n[1] * 0.002], c = [Cm[0] - n[0] * 0.002, Cm[1] - n[1] * 0.002];
    bld.kind = 1; face(bld, 'main', [P3(a, y - 0.06), P3(c, y - 0.06), P3(c, y + ARCH), P3(a, y + ARCH)], col, [mid[0] - n[0], y + 0.3, mid[1] - n[1]]); bld.kind = 0;
  }
}

// ---------- N4: stilts, quoins, drainpipes ----------
// A floor that overhangs open water by a storey or more stands on an iron frame instead of arches
// (about half the houses prefer it), the way Townscaper props up hanging corners with steel legs.
export function emitStilts(bld, F, s, y, base) {
  const L = F.L, iron = lin(IRON2);
  wb(bld, F, 0, L, -0.08, 0.025, y - 0.1, y, iron);                         // edge beam under the floor
  if (s.curve) return;
  const leg0 = Math.max(0, L - 0.07);
  wb(bld, F, leg0, L, -0.07, 0, base, y - 0.1, iron);                       // a leg at the corner
  wb(bld, F, leg0 - 0.02, L + 0.02, -0.09, 0.02, WATER - 0.05, WATER + 0.06, lin(C.stone));
  const mid = (base + y) / 2;
  wb(bld, F, 0, leg0, -0.05, -0.02, mid - 0.02, mid + 0.02, iron);          // a horizontal tie
  wseg(bld, F, leg0, base + 0.25, 0.02, mid - 0.02, -0.05, -0.025, 0.025, iron);   // and bracing
  wseg(bld, F, leg0, mid + 0.02, 0.02, y - 0.12, -0.05, -0.025, 0.025, iron);
  if (hash(Math.round(F.a[0] * 50), Math.round(F.a[1] * 50), y, 46) < 0.3) {
    // a ladder down the leg to the water
    for (let r = base + 0.1; r < y - 0.15; r += 0.09) wb(bld, F, leg0 - 0.09, leg0, 0.0, 0.012, r, r + 0.012, iron);
    wb(bld, F, leg0 - 0.095, leg0 - 0.085, -0.005, 0.015, base, y - 0.1, iron);
  }
}
// cut stone blocks that interlock up a crisp outside corner, alternating long and short
export function emitQuoins(bld, F, y, y0, y1, phase) {
  const L = F.L, stone = lin(shade(C.stoneLip, 1.02));
  for (let r = 0, yy = y0; yy < y1 - 0.05; r++, yy += 0.17) {
    const long = ((r + phase) & 1) === 0, w = long ? 0.16 : 0.09;
    wb(bld, F, Math.max(0, L - w), L, -0.01, 0.022, yy + 0.008, Math.min(y1, yy + 0.162), stone);
  }
  bld.open.push([L - 0.17, L + 1, y - 1, y + 2]);
}

export function emitWall(bld, cell, y, s, v, b, supported, vv) {
  const col = lin(b.c, toneOf(v, y));
  const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  const F = { a: s.a, t: norm2(sub2(s.b, s.a)), n: s.n, L };
  const ref = m => [m[0] - s.n[0] * 0.3, y + 0.5, m[1] - s.n[1] * 0.3];
  const mid = l2(s.a, s.b, 0.5);
  if (!s.curve) {
    const other = vv[s.k] === v ? vv[nx4(s.k)] : vv[s.k];
    if (isGable(v, y, other)) {
      // the wall rises into a gable under the verge, with a small attic window at the joint
      const Hr = y + 1 + RISE;
      bld.kind = 1; face(bld, 'main', [P3(s.a, y + 1), P3(s.b, y + 1), P3(s.a, Hr - 0.01)], col, ref(mid)); bld.kind = 0;
      if (L > 0.22) {
        const lo = Math.min(v, other), hi = Math.max(v, other), lit = hash(lo, hi, y, 24) < 0.5 ? 'lit' : 'dark';
        frameRing(bld, F, 0, 0.045, y + 1.09, y + 1.27, 0.03, lin(C.trim), true);
        hole(bld, F, 0, 0.045, y + 1.09, y + 1.27, lit);
        wb(bld, F, 0, 0.011, 0, 0.034, y + 1.09, y + 1.27, lin(C.trim));
      }
    }
  }
  const stilt = !supported && isStilted(v, y);
  if (supported || stilt) {
    const street = onStreet(v, y);
    // a wall that stands on a wall starts exactly at its floor line (overlapping the one below would put two
    // faces in one plane, a flickering strip under every storey); over arches or stilts it reaches a little lower
    const y0 = street || supported ? y : y - 0.06, sb = street ? 0.8 : 1;
    // phones keep the shader-painted bricks; desktops get instanced ones over a mortar-coloured wall
    bld.kind = lowPower ? 1 : 4; face(bld, 'main', [P3(s.a, y0), P3(s.b, y0), P3(s.b, y + 1), P3(s.a, y + 1)], col, ref(mid), [sb, sb, 1, 1]); bld.kind = 0;
    if (street) band(bld, F, 0, L, -0.02, 0.022, y, y + 0.1, lin(shade(b.c, 0.82)));
    // a slim band marks each storey, a two-step cornice sits under every eave
    if (!street && y >= 2) band(bld, F, 0, L, -0.02, 0.016, y - 0.005, y + 0.035, lin(shade(b.c, 0.88)));
    if (!has(v, y + 1)) {
      const corn = lin('#' + new THREE.Color(b.c).lerp(new THREE.Color('#ffffff'), 0.55).getHexString());
      band(bld, F, 0, L, -0.02, 0.016, y + 0.85, y + 0.9, corn);
      band(bld, F, 0, L, -0.02, 0.034, y + 0.9, y + 0.955, corn);
    }
    bld.open.length = 0;
    const top = has(v, y + 1) ? y + 1 : y + 0.85, from = street ? y + 0.1 : y + 0.035;
    const crisp = !s.curve && s.b !== s.c0 && roundOf(v, y) < 0.1 && (houseOf(v) || {}).quoins;
    if (crisp) emitQuoins(bld, F, y, from, top, (s.k === s.own ? 0 : 1) + y);
    if (!s.curve) emitFacade(bld, y, s, F, v, b, vv, cell);
    if (!lowPower) brickRows(bld, F, from, top, col, bld.open);
    if (!s.curve && street) {
      const va = vv[s.k], vb = vv[nx4(s.k)], lo = Math.min(va, vb), hi = Math.max(va, vb);
      const overlay = feature.get(PLAN.over.get(sideKey(v, va === v ? vb : va, 1)));
      if (overlay) overlay.draw(bld, { F, y, v, lo, hi });
    }
    if (stilt) emitStilts(bld, F, s, y, supportBase(v, y));
    return;
  }
  // nothing directly below: the corners become piers that reach down to whatever is there
  const base = supportBase(v, y), overWater = base < GROUND;
  const footing = (s0, s1) => {
    bld.kind = 3; band(bld, F, s0, s1, -0.17, 0.05, WATER - 0.4, WATER + 0.14, lin(C.stone)); bld.kind = 0;
    band(bld, F, s0, s1, -0.19, 0.07, WATER + 0.14, WATER + 0.2, lin(C.stoneLip));
  };
  if (s.curve) {
    bld.kind = 1; face(bld, 'main', [P3(s.a, base), P3(s.b, base), P3(s.b, y + 1), P3(s.a, y + 1)], col, ref(mid), [0.7, 0.7, 1, 1]); bld.kind = 0;
    if (overWater) footing(0, L);
    return;
  }
  const pier0 = 0.8 * L;
  if (base < y) {
    bld.kind = 1; wb(bld, F, pier0, L, -0.12, 0, base, y + 0.02, col); bld.kind = 0;
    wb(bld, F, pier0 - 0.015, L, -0.13, 0.015, y - 0.06, y + 0.01, lin(C.trim));
    if (overWater) footing(pier0 - 0.02, L);
    else wb(bld, F, pier0 - 0.02, L, -0.14, 0.02, base, base + 0.08, lin(shade(b.c, 0.8)));
  }
  bld.kind = 1; face(bld, 'main', [P3(s.a, y + ARCH), P3(s.b, y + ARCH), P3(s.b, y + 1), P3(s.a, y + 1)], col, ref(mid)); bld.kind = 0;
  // smooth arch: the crown sits at the joint, so two neighbouring halves make one arch
  const P = (sx, d, yy) => [F.a[0] + F.t[0] * sx + F.n[0] * d, yy, F.a[1] + F.t[1] * sx + F.n[1] * d];
  const open = x => x < 0.8 ? 0.58 * Math.sqrt(Math.max(0, 1 - (x / 0.8) ** 2)) : 0;
  const inner = lin(shade(b.c, 0.7)), depth = 0.12;
  const inRef = [s.a[0] - s.n[0], y + 0.3, s.a[1] - s.n[1]];
  const arch = Y => {
    const n = 14, top = Y + ARCH;
    for (let i = 0; i < n; i++) {
      const x0 = i / n, x1 = (i + 1) / n, s0 = x0 * L, s1 = x1 * L;
      const y0 = Y + open(x0), y1 = Y + open(x1);
      bld.kind = 1; face(bld, 'main', [P(s0, 0, y0), P(s1, 0, y1), P(s1, 0, top), P(s0, 0, top)], col, [inRef[0], Y + 0.3, inRef[2]]); bld.kind = 0;
      face(bld, 'main', [P(s0, 0, y0), P(s1, 0, y1), P(s1, -depth, y1), P(s0, -depth, y0)], inner, [(F.a[0] + F.t[0] * s0), Y + 3, (F.a[1] + F.t[1] * s0)]);
      face(bld, 'main', [P(s0, -depth, y0), P(s1, -depth, y1), P(s1, -depth, top), P(s0, -depth, top)], inner, [s.a[0] + s.n[0], Y + 0.3, s.a[1] + s.n[1]]);
    }
    wb(bld, F, 0, L, 0, 0.02, Y + ARCH - 0.04, Y + ARCH, lin(C.trim));
  };
  arch(y);
  // a taller gap gets an arch at every storey, tied by a beam, like an aqueduct
  for (let k = Math.max(1, Math.ceil(base - 0.01)); k < y; k++) {
    arch(k);
    bld.kind = 1; wb(bld, F, 0, L, -depth, 0, k + ARCH, k + ARCH + 0.08, col); bld.kind = 0;
    wb(bld, F, 0, L, -depth - 0.005, 0.012, k + ARCH + 0.08, k + ARCH + 0.1, lin(C.trim));
  }
}

// window, door and shop details. s = 0 is the joint at the edge midpoint, shared with the
// neighbouring cell, so a window centred there is drawn as two matching halves.
export function emitFacade(bld, y, s, F, v, b, vv, cell) {
  const va = vv[s.k], vb = vv[nx4(s.k)], lo = Math.min(va, vb), hi = Math.max(va, vb);
  const other = va === v ? vb : va;
  // both halves of the joint decide what fits from the same length, so nothing is ever drawn half
  const L = Math.min(F.L, jointHalf(v, other, y));
  if (L < 0.14) return;
  const trim = lin(C.trim), roofHex = ROOF_OF[b.c] || '#7a5a4a';
  const lit = hash(lo, hi, y, 22) < 0.6 ? 'lit' : 'dark';
  const gcol = lit === 'lit' ? [1, 1, 1] : lin(C.glass);

  // the feature the planner put on this wall side draws itself in its phase: entry features (doors,
  // stairs) replace the facade, front features (shops, hoists) sit under the dormer, window features
  // (balconies) replace the window. A draw returns false to fall back to the plain facade.
  const planned = feature.get(PLAN.side.get(sideKey(v, other, y)));
  const fc = { F, y, L, v, s, cell, lo, hi, trim, roofHex, lit };
  if (planned && planned.phase === 'entry' && planned.draw(bld, fc)) return;
  const house = houseOf(v) || { windows: 'joint', head: 0.2, shutters: false, flowers: false, balcony: 0.1, shop: false, shutterCol: SHUTTERS[0], awning: PALETTE[0].roof };
  // the window type depends on the facade edge only (not the floor), so windows stack floor to floor
  const hh = hash(lo, hi, 0, 21);
  // dormer on the roof slope above this wall, centred on the joint like the windows
  if (L > 0.3 && !has(v, y + 1) && !isolated(v, y) && !isGable(v, y, other) && hash(lo, hi, y, 31) < styleOf(v).dormers) {
    const roofHexD = roofOf(v, y), base = y + 1;
    wb(bld, F, 0, 0.13, -0.42, -0.1, base - 0.05, base + 0.3, lin(b.c, toneOf(v, y)));
    wb(bld, F, 0, 0.1, -0.1, -0.085, base + 0.04, base + 0.26, trim);
    wb(bld, F, 0, 0.07, -0.088, -0.075, base + 0.07, base + 0.23, gcol, lit);
    const P = (sx, d, yy) => [F.a[0] + F.t[0] * sx + F.n[0] * d, yy, F.a[1] + F.t[1] * sx + F.n[1] * d];
    const rc = lin(roofHexD), ref = [F.a[0] - F.n[0] * 0.25, base, F.a[1] - F.n[1] * 0.25];
    hexa(bld, 'main', [P(0, -0.06, base + 0.42), P(0.18, -0.06, base + 0.28), P(0.18, -0.46, base + 0.28), P(0, -0.46, base + 0.42),
                  P(0, -0.06, base + 0.46), P(0.18, -0.06, base + 0.32), P(0.18, -0.46, base + 0.32), P(0, -0.46, base + 0.46)], rc, [0.7, 0.7, 0.7, 0.7, 1, 1, 1, 1]);
    face(bld, 'main', [P(0, -0.1, base + 0.3), P(0.13, -0.1, base + 0.3), P(0, -0.1, base + 0.42)], lin(b.c, toneOf(v, y)), ref);
  }
  const sill = (s0, s1) => { const sy = y + styleOf(v).win.y0; wb(bld, F, s0, s1, 0, 0.08, sy - 0.05, sy, trim); };
  // each house column keeps one window-head style: plain lintel, pediment or round arch
  const headStyle = house.head;
  const head = (s1, top) => {
    if (headStyle < 0.4 || y === 1) wb(bld, F, 0, s1 + 0.03, 0, 0.04, top, top + 0.035, trim);
    else if (headStyle < 0.7) wseg(bld, F, 0, top + 0.1, s1 + 0.04, top + 0.02, 0, 0.042, 0.032, trim);
    else {
      const r = s1, N = 5;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI / 2, a1 = ((i + 1) / N) * Math.PI / 2;
        wseg(bld, F, Math.sin(a0) * r, top + Math.cos(a0) * r * 0.7, Math.sin(a1) * r, top + Math.cos(a1) * r * 0.7, 0, 0.034, 0.03, trim);
      }
    }
  };
  const W0 = styleOf(v).win;
  const jointWindow = (half = W0.half, y0 = W0.y0, y1 = W0.y1) => {
    frameRing(bld, F, 0, half, y + y0 + 0.035, y + y1 - 0.035, 0.035, trim, true);
    hole(bld, F, 0, half, y + y0 + 0.035, y + y1 - 0.035, lit);
    wb(bld, F, 0, 0.011, 0, 0.042, y + y0 + 0.035, y + y1 - 0.035, trim);
    // the cross bar sits a hair behind the upright where they cross
    if (y1 - y0 < 0.6) wb(bld, F, 0, half, 0, 0.039, y + (y0 + y1) / 2 - 0.008, y + (y0 + y1) / 2 + 0.008, trim);
    if (y1 - y0 > 0.3) head(half + 0.035, y + y1);
  };
  fc.house = house; fc.jointWindow = jointWindow;
  if (planned && planned.phase === 'front' && planned.draw(bld, fc)) return;
  if (hh < 0.06) return;   // an occasional blank wall, the same on every floor
  if (planned && planned.phase === 'window' && planned.draw(bld, fc)) return;
  const pair = L > 0.34 && (house.windows === 'pair' || (house.windows === 'mix' && hh > 0.5));
  if (pair) {
    const sc = L * 0.55, hw = W0.half * 0.78, ya = y + W0.y0 + 0.035, yb = y + W0.y1 - 0.035;
    frameRing(bld, F, sc - hw, sc + hw, ya, yb, 0.035, trim);
    hole(bld, F, sc - hw, sc + hw, ya, yb, lit);
    wb(bld, F, sc - 0.006, sc + 0.006, 0, 0.042, ya, yb, trim);
    wb(bld, F, sc - hw, sc + hw, 0, 0.042, (ya + yb) / 2 - 0.008, (ya + yb) / 2 + 0.008, trim);
    sill(sc - hw - 0.055, sc + hw + 0.055);
    if (house.type === 'warehouse') return;
    if (house.shutters && L > 0.42) {
      const sh = lin(house.shutterCol);
      wb(bld, F, sc - 0.17, sc - 0.105, 0, 0.04, y + 0.42, y + 0.73, sh);
      wb(bld, F, sc + 0.105, sc + 0.17, 0, 0.04, y + 0.42, y + 0.73, sh);
    }
    return;
  }
  if (house.type === 'tower' && y >= 2 && y === topOf(v)) {
    // a round window near the top of a tower
    const cy = y + 0.56, r = 0.11, N = 6;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI, a1 = ((i + 1) / N) * Math.PI;
      wseg(bld, F, Math.sin(a0) * r, cy + Math.cos(a0) * r, Math.sin(a1) * r, cy + Math.cos(a1) * r, 0, 0.03, 0.03, trim);
    }
    hole(bld, F, 0, 0.07, cy - 0.07, cy + 0.07, lit);
    wb(bld, F, 0, 0.011, 0, 0.034, cy - 0.08, cy + 0.08, trim);
    wb(bld, F, 0, 0.08, 0, 0.034, cy - 0.006, cy + 0.006, trim);
    return;
  }
  jointWindow();
  sill(0, W0.half + 0.055);
  if (house.type === 'warehouse') return;
  if (house.shutters && L > 0.3) wb(bld, F, W0.half + 0.04, W0.half + 0.12, 0, 0.04, y + W0.y0 + 0.02, y + W0.y1 - 0.01, lin(house.shutterCol));
  else if (house.flowers) {
    const fy = y + W0.y0;
    wb(bld, F, 0, W0.half + 0.07, 0, 0.1, fy - 0.03, fy + 0.04, lin(C.leaf));
    for (const sx of [0.03, W0.half]) wb(bld, F, sx, sx + 0.035, 0.05, 0.085, fy + 0.04, fy + 0.08, lin(hh > 0.5 ? '#f2a7b5' : '#fbe7a1'));
  }
}

// a raised cap tile along a roof line
export function capLine(bld, p0, p1, col) {
  const dx = p1[0] - p0[0], dz = p1[2] - p0[2], L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  // caps meeting at a joint overlap; each sits at its own hair of height so their tops never tie
  const e = 0.003 * hash(Math.round((p0[0] + p1[0]) * 97), Math.round((p0[1] + p1[1]) * 97), Math.round((p0[2] + p1[2]) * 97), 92);
  const sx = -dz / L * 0.026, sz = dx / L * 0.026, h0 = 0.004 + e, h1 = 0.042 + e;
  hexa(bld, 'main', [[p0[0] - sx, p0[1] + h0, p0[2] - sz], [p0[0] + sx, p0[1] + h0, p0[2] + sz], [p1[0] + sx, p1[1] + h0, p1[2] + sz], [p1[0] - sx, p1[1] + h0, p1[2] - sz],
                [p0[0] - sx, p0[1] + h1, p0[2] - sz], [p0[0] + sx, p0[1] + h1, p0[2] + sz], [p1[0] + sx, p1[1] + h1, p1[2] + sz], [p1[0] - sx, p1[1] + h1, p1[2] - sz]], col);
}

export function emitLighthouse(bld, ci, y, v, b, R, Vq, roofHex) {
  const top = y + 1, deck = lin(C.stoneLip), edge = lin(shade(C.stoneLip, 0.78));
  const pt = (r, o) => r.e ? [r.p[0] + r.off[0] * o, r.p[1] + r.off[1] * o] : r.p;
  // gallery deck overhanging the tower, ringed by a railing
  for (let i = 0; i < R.length - 1; i++) {
    const a = pt(R[i], 0.13), c = pt(R[i + 1], 0.13);
    face(bld, 'main', [P3(Vq, top + 0.03), P3(a, top + 0.03), P3(c, top + 0.03)], deck, P3(Vq, top - 1));
    face(bld, 'main', [P3(a, top - 0.06), P3(c, top - 0.06), P3(c, top + 0.03), P3(a, top + 0.03)], edge, P3(Vq, top));
    face(bld, 'main', [P3(a, top - 0.06), P3(c, top - 0.06), P3(R[i + 1].p, top - 0.06), P3(R[i].p, top - 0.06)], edge, P3(Vq, top + 2));
    railing(bld, pt(R[i], 0.11), pt(R[i + 1], 0.11), top + 0.03);
  }
  if (vCells[v][0][0] !== ci) return;
  // lantern room: glass panels between iron posts under a small domed cap
  const [x, z] = Vq, r = 0.17, y0 = top + 0.1, y1 = top + 0.5;
  boxAt(bld, x, z, 0.2, top + 0.03, y0, lin(shade(b.c, 0.92)));
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    face(bld, 'lit', [P3(p0, y0), P3(p1, y0), P3(p1, y1), P3(p0, y1)], [1, 1, 1], P3(Vq, (y0 + y1) / 2));
    boxAt(bld, p0[0], p0[1], 0.012, y0, y1, IRON);
    const c0 = [x + Math.cos(a0) * 0.24, z + Math.sin(a0) * 0.24], c1 = [x + Math.cos(a1) * 0.24, z + Math.sin(a1) * 0.24];
    face(bld, 'main', [P3(c0, y1), P3(c1, y1), [x, y1 + 0.32, z]], lin(roofHex, 0.85), [x, y1 - 0.5, z]);
    face(bld, 'main', [P3(c0, y1), P3(c1, y1), [x, y1 - 0.01, z]], lin(shade(roofHex, 0.6)), [x, y1 + 1, z]);
  }
  boxAt(bld, x, z, 0.03, y1 + 0.28, y1 + 0.42, lin(C.gold));
}

export function emitRoof(bld, ci, q, y, v, b, R, Vq) {
  const roofHex = roofOf(v, y);
  const Hr = y + 1 + RISE, E = y + 1 - DROP, HV = apexOf(v, y);
  const roof = lin(roofHex, 0.95 + hash(v, y, 2, 2) * 0.1);
  const pt = r => r.g ? [r.p[0] + r.off[0] * OVER, Hr, r.p[1] + r.off[1] * OVER]
    : r.e ? [r.p[0] + r.off[0] * OVER, E + RT, r.p[1] + r.off[1] * OVER] : [r.p[0], Hr, r.p[1]];
  const apex = [Vq[0], HV, Vq[1]], below = [Vq[0], y + 0.3, Vq[1]];
  const flat = R.every(r => !r.e) && HV === Hr;
  if (isLighthouse(v, y)) { emitLighthouse(bld, ci, y, v, b, R, Vq, roofHex); return; }
  if (flat) {
    // the inside of a big block becomes a roof terrace, sometimes a garden
    const g = hash(v, y, ci, 4);
    const col = g < 0.35 ? lin(C.grass) : lin(roofHex, 0.86);
    for (let i = 0; i < R.length - 1; i++) face(bld, 'main', [apex, pt(R[i]), pt(R[i + 1])], col, below);
    if (g < 0.35 && hash(v, y, ci, 5) < 0.5) {
      const p = l2(Vq, R[1].p, 0.5);
      boxAt(bld, p[0], p[1], 0.07, Hr, Hr + 0.16, lin(C.leaf));
    } else if (g > 0.8) {
      const p = l2(Vq, R[1].p, 0.45);
      boxAt(bld, p[0], p[1], 0.05, Hr, Hr + 0.1, lin('#c9876b'));
      boxAt(bld, p[0], p[1], 0.06, Hr + 0.1, Hr + 0.2, lin(C.leaf));
    }
    return;
  }
  const fasc = lin(shade(roofHex, 0.72)), soff = lin(shade(b.c, 0.6));
  const capCol = lin(shade(roofHex, 0.74));
  const cone = R.some(r => r.cv);
  for (let i = 0; i < R.length - 1; i++) {
    const a = pt(R[i]), c = pt(R[i + 1]);
    bld.kind = 2; face(bld, 'main', [apex, a, c], roof, below, [1.07, 0.93, 0.93]); bld.kind = 0;
    if (R[i].e && R[i + 1].e) {
      const ao = [a[0], a[1] - RT, a[2]], co = [c[0], c[1] - RT, c[2]];
      const wallY = r => r.g ? Hr - RT - 0.02 : y + 1;
      face(bld, 'main', [ao, co, c, a], fasc, [Vq[0], E, Vq[1]]);
      face(bld, 'main', [ao, co, P3(R[i + 1].p, wallY(R[i + 1])), P3(R[i].p, wallY(R[i]))], soff, [(a[0] + c[0]) / 2, y + 6, (a[2] + c[2]) / 2]);
    }
  }
  // caps only where two slopes really meet: ridges between houses, hips where the wall turns
  // at an edge midpoint, and the hip over a crisp outer corner
  const cell = cells[ci];
  const turns = k => {
    const nb = cells[cell.nb[k]];
    if (!nb) return true;
    const m = xz(cell, UVM[k][0], UVM[k][1]), c0 = xz(cell, 0.5, 0.5);
    const d1 = norm2(sub2(c0, m)), d2 = norm2(sub2(nb.c, m));
    return d1[0] * d2[0] + d1[1] * d2[1] > -0.9;
  };
  for (const [r, k] of [[R[0], q], [R[R.length - 1], pv4(q)]]) {
    if (!r.e || r.g) capLine(bld, apex, pt(r), capCol);
    else if (turns(k) && !cone) capLine(bld, apex, pt(r), capCol);
  }
  if (cone && roundOf(v, y) < 0.15) capLine(bld, apex, pt(R[Math.floor(R.length / 2)]), capCol);
  const primary = vCells[v][0][0] === ci;
  if (!primary) return;
  if (HV > Hr + 0.3) {
    boxAt(bld, Vq[0], Vq[1], 0.035, HV - 0.05, HV + 0.12, lin(C.gold));
    boxAt(bld, Vq[0], Vq[1], 0.012, HV + 0.12, HV + 0.32, lin(C.gold));
  } else if (!isolated(v, y) && houseOf(v) && houseOf(v).chimneys.has(v) && y === topOf(v)) {
    const p = l2(Vq, R[0].p, 0.42);
    boxAt(bld, p[0], p[1], 0.065, y + 1.05, Hr + 0.22, lin(C.stone));
    boxAt(bld, p[0], p[1], 0.085, Hr + 0.22, Hr + 0.27, lin(shade(C.stone, 0.82)));
    const pot = lin('#b8694c');
    boxAt(bld, p[0] - 0.03, p[1], 0.022, Hr + 0.27, Hr + 0.36, pot);
    if (hash(v, y, 6, 7) < 0.5) boxAt(bld, p[0] + 0.035, p[1] + 0.01, 0.02, Hr + 0.27, Hr + 0.33, pot);
  }
}
