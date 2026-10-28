import { EDGE, GROUND, GROUND_ROUND, WATER } from '../core/dims.js';
import { UVM, VERTS, cells, nx4, pv4, vAdj, vCells, xz } from '../core/grid.js';
import { has } from '../core/model.js';
import { C, IRON, LEAVES, PAVERS } from '../core/palette.js';
import { P3, hash, l2, lin, norm2, outward, sub2 } from '../core/util.js';
import { blob, boxAt, face, hexa, pickQuad, pickTri, spot } from './builder.js';
import { PLAN } from '../plan/planner.js';
import { edgeKey } from '../plan/analysis.js';
import { feature } from '../features/index.js';

// ---------- the street layer ----------
export function emitGroundCell(bld, ci) {
  const cell = cells[ci], vv = cell.v;
  const f = vv.map(v => has(v, 0));
  if (!f.some(Boolean)) return;
  const Cm = xz(cell, 0.5, 0.5), Mp = UVM.map(m => xz(cell, m[0], m[1])), Vp = cell.q;
  const Qc = [0, 1, 2, 3].map(q => [(Vp[q][0] + Mp[q][0] + Cm[0] + Mp[pv4(q)][0]) / 4, (Vp[q][1] + Mp[q][1] + Cm[1] + Mp[pv4(q)][1]) / 4]);
  const all4 = f.every(Boolean);
  const convex = q => f[q] && !f[nx4(q)] && !f[pv4(q)];
  const wallAt = k => f[k] !== f[nx4(k)];
  const trimmed = k => convex(k) || convex(nx4(k));
  const cm = [0, 0];
  let first = null;
  for (let k = 0; k < 4; k++) if (wallAt(k) && !trimmed(k)) {
    const n = outward(Mp[k], Cm, Qc[f[k] ? k : nx4(k)]);
    cm[0] += n[0]; cm[1] += n[1]; first = first || n;
  }
  const cmu = norm2(cm), cmag = first ? 1 / Math.max(0.55, cmu[0] * first[0] + cmu[1] * first[1]) : 0;
  const cOff = [cmu[0] * cmag, cmu[1] * cmag];
  const mInfo = k => {
    const e = wallAt(k);
    let off = [0, 0];
    if (e) { const fil = f[k] ? k : nx4(k), emp = f[k] ? nx4(k) : k; off = norm2(sub2(Vp[emp], Vp[fil])); }
    return { p: Mp[k], e, off };
  };
  const grout = lin('#c2b8a6'), stone = lin(C.stone), curb = lin('#b04f3e');
  for (let q = 0; q < 4; q++) {
    if (!f[q]) continue;
    const v = vv[q], Vq = Vp[q];
    const R = [mInfo(q)];
    if (convex(q)) {
      const A = l2(Cm, Mp[q], GROUND_ROUND), B = l2(Cm, Mp[pv4(q)], GROUND_ROUND), N = 6, pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        pts.push([a * A[0] + b * Cm[0] + c * B[0], a * A[1] + b * Cm[1] + c * B[1]]);
      }
      for (let i = 0; i <= N; i++) R.push({ p: pts[i], e: true, cv: true, off: outward(pts[Math.max(0, i - 1)], pts[Math.min(N, i + 1)], Qc[q]) });
    } else R.push({ p: Cm, e: !all4, off: cOff });
    R.push(mInfo(pv4(q)));
    const pt = (r, o = EDGE) => r.e ? [r.p[0] + r.off[0] * o, r.p[1] + r.off[1] * o] : r.p;
    for (let i = 0; i < R.length - 1; i++) {
      const a = pt(R[i]), c = pt(R[i + 1]);
      face(bld, 'main', [P3(Vq, GROUND), P3(a, GROUND), P3(c, GROUND)], grout, P3(Vq, 0));
      pickTri(bld, P3(Vq, GROUND), P3(a, GROUND), P3(c, GROUND), { v, y: 0, t: 'top' });
      if (R[i].e && R[i + 1].e) {
        // quay wall with a light kerb, foam where it meets the water
        bld.kind = 3; face(bld, 'main', [P3(a, GROUND), P3(c, GROUND), P3(c, 0.1), P3(a, 0.1)], stone, P3(Vq, 0.5), [1, 1, 0.62, 0.62]); bld.kind = 0;
        const ak = pt(R[i], EDGE + 0.045), ck = pt(R[i + 1], EDGE + 0.045), ai = pt(R[i], EDGE - 0.06), ci2 = pt(R[i + 1], EDGE - 0.06);
        hexa(bld, 'main', [P3(ai, GROUND - 0.12), P3(ci2, GROUND - 0.12), P3(ck, GROUND - 0.12), P3(ak, GROUND - 0.12),
                      P3(ai, GROUND + 0.045), P3(ci2, GROUND + 0.045), P3(ck, GROUND + 0.045), P3(ak, GROUND + 0.045)], curb, [0.8, 0.8, 0.8, 0.8, 1, 1, 1, 1]);
        const f0a = pt(R[i], EDGE + 0.05), f0c = pt(R[i + 1], EDGE + 0.05), fa = pt(R[i], EDGE + 0.2), fc = pt(R[i + 1], EDGE + 0.2);
        face(bld, 'foam', [P3(f0a, WATER + 0.012), P3(f0c, WATER + 0.012), P3(fc, WATER + 0.012), P3(fa, WATER + 0.012)], lin(C.foam), P3(Vq, -2));
        const sa = pt(R[i], EDGE + 1.0), sc = pt(R[i + 1], EDGE + 1.0);
        face(bld, 'main', [P3(a, WATER - 0.14), P3(c, WATER - 0.14), P3(sc, WATER - 0.85), P3(sa, WATER - 0.85)], lin('#d9c69c'), P3(Vq, WATER - 3));
        pickQuad(bld, P3(a, WATER), P3(c, WATER), P3(c, GROUND), P3(a, GROUND), { v, y: 0, t: 'side', cands: [vv[nx4(q)], vv[pv4(q)]] });
        // the planned feature on this quay edge, drawn once, in the cell the planner chose
        const facing = i === 0 ? vv[nx4(q)] : i === R.length - 2 ? vv[pv4(q)] : -1;
        const straight = !(R[i].cv && R[i + 1].cv), L2 = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const ef = facing >= 0 && straight ? PLAN.edge.get(edgeKey(v, facing)) : null;
        const kf = ef ? feature.get(ef.kind) : null, here = kf && ef.cell === ci && (L2 > 0.3 || kf.clearsEdge) ? kf : null;
        // a boat moored alongside needs the whole edge open, in both cells, to step aboard
        if (here && here.replacesRailing || kf && kf.clearsEdge) { if (here) here.draw(bld, { a, c, Vq, L2, v, n: facing }); }
        else if (!has(v, 1)) {
          railing(bld, pt(R[i], EDGE - 0.02), pt(R[i + 1], EDGE - 0.02), GROUND + 0.045);
          if (here) here.draw(bld, { a, c, Vq, L2, v, n: facing });
          // a free stretch of railing is somewhere to lean and watch the water
          else if (facing >= 0 && straight && L2 > 0.3) {
            const out = outward(a, c, Vq), m = l2(a, c, 0.5);
            spot(bld, 'quay', v, [m[0] - out[0] * 0.15, m[1] - out[1] * 0.15], out, GROUND);
          }
        }
      }
    }
    if (has(v, 1) || isCourtyard(v)) continue;
    // cobbled paving: a 3x3 grid of slightly irregular stones over the grout
    const A = Vq, B = Mp[q], Cc = Cm, D = Mp[pv4(q)];
    const P = (u, w) => [A[0] * (1 - u) * (1 - w) + B[0] * u * (1 - w) + Cc[0] * u * w + D[0] * (1 - u) * w,
                         A[1] * (1 - u) * (1 - w) + B[1] * u * (1 - w) + Cc[1] * u * w + D[1] * (1 - u) * w];
    const n = 3, g = 0.05;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (convex(q) && i === n - 1 && j === n - 1) continue;
      const u0 = i / n + g, u1 = (i + 1) / n - g, w0 = j / n + g, w1 = (j + 1) / n - g;
      const h = hash(ci, q * 16 + i * 4 + j, 3, 3), top = GROUND + 0.012 + h * 0.008;
      const col = lin(PAVERS[Math.floor(h * PAVERS.length)], 0.97 + hash(ci, q, i, j) * 0.06);
      const corners = [P(u0, w0), P(u1, w0), P(u1, w1), P(u0, w1)];
      hexa(bld, 'main', [...corners.map(c => P3(c, GROUND - 0.01)), ...corners.map(c => P3(c, top))], col, [0.8, 0.8, 0.8, 0.8, 1, 1, 1, 1]);
    }
    // planned features on this open tile, drawn once by the tile's first cell
    if (vCells[v][0][0] === ci) emitTileFeature(bld, v, PLAN.node.get(v));
  }
}
export function emitTileFeature(bld, v, kind) {
  const f = feature.get(kind);
  if (f) f.draw(bld, { v, x: VERTS[v][0], z: VERTS[v][1] });
}
// a tree in a round planter
export function plantedTree(bld, x, z, seed) {
  boxAt(bld, x, z, 0.13, GROUND, GROUND + 0.1, lin(C.stoneLip));
  boxAt(bld, x, z, 0.11, GROUND + 0.1, GROUND + 0.105, lin('#6b5845'));
  boxAt(bld, x, z, 0.025, GROUND + 0.1, GROUND + 0.5, lin(C.wood));
  const leaf = LEAVES[Math.floor(hash(seed, 1, 1, 49) * LEAVES.length)], s = 0.24 + hash(seed, 2, 2, 49) * 0.08;
  blob(bld, x, GROUND + 0.66, z, s, s * 1.05, s, leaf);
  blob(bld, x + 0.08, GROUND + 0.86, z - 0.05, s * 0.68, s * 0.7, s * 0.68, LEAVES[(Math.floor(hash(seed, 3, 3, 49) * 5))]);
}

// a thin iron railing: posts at even spacing and two rails, joined across cells by shared endpoints
export function railing(bld, a, c, base) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (L < 0.02) return;
  const t = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n = [-t[1] * 0.006, t[0] * 0.006];
  const bar = (p, q, y0, y1) => hexa(bld, 'main', [[p[0] - n[0], y0, p[1] - n[1]], [q[0] - n[0], y0, q[1] - n[1]], [q[0] + n[0], y0, q[1] + n[1]], [p[0] + n[0], y0, p[1] + n[1]],
                                               [p[0] - n[0], y1, p[1] - n[1]], [q[0] - n[0], y1, q[1] - n[1]], [q[0] + n[0], y1, q[1] + n[1]], [p[0] + n[0], y1, p[1] + n[1]]], IRON);
  bar(a, c, base + 0.25, base + 0.27);
  bar(a, c, base + 0.13, base + 0.142);
  const k = Math.max(1, Math.round(L / 0.16));
  for (let j = 0; j < k; j++) {
    const p = l2(a, c, j / k);
    boxAt(bld, p[0], p[1], 0.008, base, base + 0.266, IRON);   // just under the rail, so their tops don't tie
  }
}
// a street tile hemmed in by houses on every side becomes a little garden
export function isCourtyard(v) {
  return has(v, 0) && !has(v, 1) && vAdj[v].length > 0 && vAdj[v].every(n => has(n, 1));
}

export function emitCourtyard(bld, v, trees) {
  const grass = lin(C.grass), G = GROUND + 0.02;
  for (const [ci, k] of vCells[v]) {
    const cell = cells[ci], Vp = cell.q[k];
    const a = xz(cell, UVM[k][0], UVM[k][1]), c = xz(cell, 0.5, 0.5), d = xz(cell, UVM[pv4(k)][0], UVM[pv4(k)][1]);
    face(bld, 'main', [P3(Vp, G), P3(a, G), P3(c, G), P3(d, G)], grass, P3(Vp, 0));
  }
  const [x, z] = VERTS[v], r = hash(v, 0, 3, 9);
  if (r < 0.7) {
    boxAt(bld, x, z, 0.05, G, G + 0.43, lin(C.wood));
    const s = 0.3 + hash(v, 1, 2, 3) * 0.12;
    trees.push([x, G + 0.6, z, s], [x + 0.08, G + 0.84, z - 0.05, s * 0.7]);
  } else {
    // a little well
    boxAt(bld, x, z, 0.14, G, G + 0.19, lin(C.stoneLip));
    boxAt(bld, x, z, 0.1, G + 0.17, G + 0.195, lin('#4f7fa0'));
    for (const [dx, dz] of [[-0.17, 0.12], [0.15, -0.16], [0.16, 0.15]]) boxAt(bld, x + dx, z + dz, 0.035, G, G + 0.08, lin(dx > 0 ? '#f2a7b5' : '#fbe7a1'));
  }
}
