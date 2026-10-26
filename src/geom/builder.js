import * as THREE from 'three';
import { hash, lin } from '../core/util.js';

// ---------- mesh emission ----------
// A builder is the explicit target of all geometry code: the mesh buckets being filled, the surface kind
// for the painted-material shader (0 plain, 1 brick, 2 roof tiles, 3 cut stone, 4 mortar), the openings
// on the wall being decorated (so bricks and ivy keep clear of windows), the pick triangles sink, and an
// optional tag that labels what is being drawn (bucket.tags), for checks such as the openings test.
export function makeBuilder(mesh, pick = { P: [], meta: [] }) {
  return { mesh, kind: 0, open: [], pick, tag: null };
}
export const bucket = () => ({ p: [], c: [], k: [], inst: [] });
// dev only: when on, every triangle records the source line that emitted it (bucket.src), so geometry
// problems found by inspection tools can be traced to the code that made them
export const TRACE = { on: false };
function caller() {
  const lines = new Error().stack.split('\n');
  for (const l of lines.slice(2)) {
    if (l.includes('builder.js') || !l.includes('/src/')) continue;
    const fn = (l.match(/at (?:Object\.)?([\w$]+) \(/) || [])[1];
    return (fn ? fn + '@' : '') + l.replace(/^.*\/src\//, '').replace(/\)$/, '').replace(/:\d+$/, '');
  }
  return '?';
}
// main town surfaces, glass, foam, window cut masks, the rooms behind windows, and instanced bricks
export const newMesh = () => ({ main: bucket(), lit: bucket(), dark: bucket(), foam: bucket(), mask: bucket(), roomLit: bucket(), roomDark: bucket(), bricks: bucket() });

export function face(bld, bk, pts, col, ref, sh) {
  let nx, ny, nz;
  if (pts.length === 4) {
    const d1 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const d2 = [pts[3][0] - pts[1][0], pts[3][1] - pts[1][1], pts[3][2] - pts[1][2]];
    nx = d1[1] * d2[2] - d1[2] * d2[1]; ny = d1[2] * d2[0] - d1[0] * d2[2]; nz = d1[0] * d2[1] - d1[1] * d2[0];
  } else {
    const [a, b, c] = pts;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
  }
  if (nx * nx + ny * ny + nz * nz < 1e-14) return;
  let cx = 0, cy = 0, cz = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
  const n = pts.length;
  if (nx * (cx / n - ref[0]) + ny * (cy / n - ref[1]) + nz * (cz / n - ref[2]) < 0) { pts = pts.slice().reverse(); if (sh) sh = sh.slice().reverse(); }
  const B = bld.mesh[bk], tri = n === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
  if (TRACE.on) { const at = caller(); (B.src || (B.src = [])).push(at); if (n === 4) B.src.push(at); }
  // tagged geometry (bld.tag set by the code drawing it) is remembered by triangle index, for checks
  if (bld.tag) { const T = B.tags || (B.tags = new Map()), t0 = B.p.length / 9; T.set(t0, bld.tag); if (n === 4) T.set(t0 + 1, bld.tag); }
  for (const i of tri) {
    const p = pts[i], s = sh ? sh[i] : 1;
    B.p.push(p[0], p[1], p[2]);
    B.c.push(col[0] * s, col[1] * s, col[2] * s);
    B.k.push(bld.kind);
  }
}
export const HEX_FACES = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [3, 2, 1, 0], [4, 5, 6, 7]];
export function hexa(bld, bk, P, col, sh = null) {
  let rx = 0, ry = 0, rz = 0;
  for (const p of P) { rx += p[0]; ry += p[1]; rz += p[2]; }
  const ref = [rx / 8, ry / 8, rz / 8];
  for (const ix of HEX_FACES) face(bld, bk, ix.map(i => P[i]), col, ref, sh && ix.map(i => sh[i]));
}
export function boxAt(bld, x, z, hw, y0, y1, col, bk = 'main') {
  hexa(bld, bk, [[x - hw, y0, z - hw], [x + hw, y0, z - hw], [x + hw, y0, z + hw], [x - hw, y0, z + hw],
            [x - hw, y1, z - hw], [x + hw, y1, z - hw], [x + hw, y1, z + hw], [x - hw, y1, z + hw]], col);
}

// ---------- N1: real bricks ----------
// A chamfered unit brick, instanced thousands of times. Each brick is placed on a wall frame with its
// own size jitter, how far it stands proud of the wall, and its own tint, so every edge catches light.
export const BRICK_STRIDE = 13;   // centre xyz, along-wall xz, outward xz, width, height, depth, rgb
export function brickRows(bld, F, y0, y1, col, open, clip, size = [0.23, 0.1], proud = [0.003, 0.006], spread = 0.18) {
  const [bw, bh] = size, L = F.L;
  const B = bld.mesh.bricks.inst;
  for (let r = 0; y0 + r * bh + bh * 0.5 < y1; r++) {
    const yb = y0 + r * bh, yt = Math.min(y1, yb + bh);
    if (yt - yb < bh * 0.45) continue;
    const off = (r & 1) ? bw * 0.5 : 0;
    for (let sx = -off; sx < L; sx += bw) {
      let s0 = Math.max(0, sx) + 0.004, s1 = Math.min(L, sx + bw) - 0.004;
      // a brick that runs into an opening is cut at its edge, like masonry at a window reveal; the larger
      // piece stays (judged by the brick's extent, not its centre, so nothing pokes into the glass)
      if (open) for (const o of open) {
        if (yt <= o[2] || yb >= o[3] || s1 <= o[0] || s0 >= o[1]) continue;
        if (o[0] - s0 >= s1 - o[1]) s1 = o[0] - 0.004; else s0 = o[1] + 0.004;
      }
      if (s1 - s0 < 0.035) continue;
      const sm = (s0 + s1) / 2, ym = (yb + yt) / 2;
      if (clip && !clip(sm, ym)) continue;
      const x = F.a[0] + F.t[0] * sm, z = F.a[1] + F.t[1] * sm;
      const h1 = hash(Math.round(x * 97), Math.round(z * 97), Math.round(ym * 50), 77), h2 = hash(Math.round(x * 89), Math.round(ym * 61), 3, 78);
      const pr = proud[0] + proud[1] * h1, depth = pr + 0.012;
      const d = pr - depth / 2;
      const k = 1 - spread * 0.5 + spread * h2;
      B.push(x + F.n[0] * d, ym, z + F.n[1] * d, F.t[0], F.t[1], F.n[0], F.n[1],
        (s1 - s0) * (0.97 + 0.03 * h1), (yt - yb) * 0.88, depth,
        col[0] * k * (1 + (h1 - 0.5) * 0.08), col[1] * k, col[2] * k * (1 + (h2 - 0.5) * 0.08));
    }
  }
}

// Runs that wrap around a building (storey bands, cornices, plinths, footings) are drawn per wall segment, so
// at every corner two of them overlap. Their tops would lie in one plane and z-fight. Each run is lifted by
// a few tenths of a millimetre that depend on its direction: runs along one straight wall keep exactly the
// same height and meet without a step, and runs that meet at a corner never share a plane.
export const lift = F => 0.006 * ((Math.atan2(F.t[1], F.t[0]) / Math.PI + 1) % 1);
export function band(bld, F, s0, s1, d0, d1, y0, y1, col) { const e = lift(F); wb(bld, F, s0, s1, d0, d1, y0 + e, y1 + e, col); }
// Details are authored in round numbers, so a door leaf, its frame, a sill and a mullion often share a face
// plane exactly and z-fight. Every box is therefore grown by one of sixteen hair widths (0 to 3.75 mm), picked
// from its own position and size: two different boxes almost never land on the same plane, and nothing
// visibly changes. (Faces that look identical may still tie; that can't be seen.)
const SKIN = 0.00025;
export function wb(bld, F, s0, s1, d0, d1, y0, y1, col, bk = 'main') {
  const e = SKIN * Math.floor(16 * hash(Math.round((F.a[0] + F.t[0] * s0) * 503) ^ Math.round((s1 - s0) * 997), Math.round((F.a[1] + F.t[1] * s0) * 503),
    Math.round(y0 * 509) ^ Math.round((y1 - y0) * 991), Math.round((d0 + d1) * 1013) + 94));
  s0 -= e; s1 += e; d0 -= e; d1 += e; y0 -= e; y1 += e;
  const P = (s, d, yy) => [F.a[0] + F.t[0] * s + F.n[0] * d, yy, F.a[1] + F.t[1] * s + F.n[1] * d];
  hexa(bld, bk, [P(s0, d0, y0), P(s1, d0, y0), P(s1, d1, y0), P(s0, d1, y0), P(s0, d0, y1), P(s1, d0, y1), P(s1, d1, y1), P(s0, d1, y1)], col);
}
// sloped bar along a wall: from (s0, ya) to (s1, yb)
export function wseg(bld, F, s0, ya, s1, yb, d0, d1, th, col) {
  const P = (s, d, yy) => [F.a[0] + F.t[0] * s + F.n[0] * d, yy, F.a[1] + F.t[1] * s + F.n[1] * d];
  hexa(bld, 'main', [P(s0, d0, ya), P(s1, d0, yb), P(s1, d1, yb), P(s0, d1, ya), P(s0, d0, ya + th), P(s1, d0, yb + th), P(s1, d1, yb + th), P(s0, d1, ya + th)], col);
}
// ---------- N2: windows cut through the wall ----------
// A mask quad marks the opening in the stencil buffer; a small inside-out room drawn only where the
// mask is visible makes the wall look cut, with depth behind the glass line.
export function hole(bld, F, s0, s1, y0, y1, lit) {
  bld.open.push([s0 - 0.03, s1 + 0.03, y0 - 0.05, y1 + 0.05]);
  const P = (s, d, yy) => [F.a[0] + F.t[0] * s + F.n[0] * d, yy, F.a[1] + F.t[1] * s + F.n[1] * d];
  const D = 0.003, back = -0.16;
  face(bld, 'mask', [P(s0, D, y0), P(s1, D, y0), P(s1, D, y1), P(s0, D, y1)], [1, 1, 1], P((s0 + s1) / 2, -1, (y0 + y1) / 2));
  hexa(bld, lit === 'lit' ? 'roomLit' : 'roomDark',
    [P(s0, back, y0), P(s1, back, y0), P(s1, 0, y0), P(s0, 0, y0), P(s0, back, y1), P(s1, back, y1), P(s1, 0, y1), P(s0, 0, y1)],
    [1, 1, 1], [0.42, 0.42, 0.9, 0.9, 0.55, 0.55, 1, 1]);
}
// a frame of four bars around an opening; joint windows skip the bar on the shared joint
export function frameRing(bld, F, s0, s1, y0, y1, t, col, skipLeft = false) {
  wb(bld, F, s0 - (skipLeft ? 0 : t), s1 + t, 0, 0.025, y0 - t, y0, col);
  wb(bld, F, s0 - (skipLeft ? 0 : t), s1 + t, 0, 0.025, y1, y1 + t, col);
  wb(bld, F, s1, s1 + t, 0, 0.025, y0, y1, col);
  if (!skipLeft) wb(bld, F, s0 - t, s0, 0, 0.025, y0, y1, col);
}
export function wslab(bld, F, s0, s1, d0, ya, d1, yb, th, col) {
  const P = (s, d, yy) => [F.a[0] + F.t[0] * s + F.n[0] * d, yy, F.a[1] + F.t[1] * s + F.n[1] * d];
  hexa(bld, 'main', [P(s0, d0, ya), P(s1, d0, ya), P(s1, d1, yb), P(s0, d1, yb), P(s0, d0, ya + th), P(s1, d0, ya + th), P(s1, d1, yb + th), P(s0, d1, yb + th)], col, [0.7, 0.7, 0.7, 0.7, 1, 1, 1, 1]);
}

export function pickQuad(bld, a, b, c, d, meta) { bld.pick.P.push(...a, ...b, ...c, ...a, ...c, ...d); bld.pick.meta.push(meta, meta); }
export function pickTri(bld, a, b, c, meta) { bld.pick.P.push(...a, ...b, ...c); bld.pick.meta.push(meta); }
// ---------- L3/L4: greenery and props ----------
export const ICO = (() => {
  const p = new THREE.IcosahedronGeometry(1, 0).attributes.position.array, tris = [];
  for (let i = 0; i < p.length; i += 9) tris.push([[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]]);
  return tris;
})();
// a faceted leafy blob; with a wall frame it can be flattened against the wall
export function blob(bld, cx, cy, cz, rx, ry, rz, hex, axes = null) {
  const col = lin(hex);
  // clumps of the same size side by side would share face planes and flicker; each is sized a little apart
  const h = hash(Math.round(cx * 211), Math.round(cy * 211), Math.round(cz * 211), 91), k = 1 + 0.03 * h;
  rx *= k; ry *= k; rz *= k;
  // and clumps on a wall sit at slightly different depths, for the same reason
  if (axes) { cx += axes.n[0] * 0.004 * h; cz += axes.n[1] * 0.004 * h; }
  for (const tri of ICO) {
    const pts = tri.map(([x, y, z]) => axes
      ? [cx + axes.t[0] * x * rx + axes.n[0] * z * rz, cy + y * ry, cz + axes.t[1] * x * rx + axes.n[1] * z * rz]
      : [cx + x * rx, cy + y * ry, cz + z * rz]);
    face(bld, 'main', pts, col, [cx, cy, cz], tri.map(([, y]) => 0.82 + 0.22 * (y + 1) / 2));
  }
}
// a thin rod between two 3D points (ropes, poles)
export function rod(bld, a, b, r, col) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, sx = -dz / L * r, sz = dx / L * r;
  hexa(bld, 'main', [[a[0] - sx, a[1] - r, a[2] - sz], [b[0] - sx, b[1] - r, b[2] - sz], [b[0] + sx, b[1] - r, b[2] + sz], [a[0] + sx, a[1] - r, a[2] + sz],
                [a[0] - sx, a[1] + r, a[2] - sz], [b[0] - sx, b[1] + r, b[2] - sz], [b[0] + sx, b[1] + r, b[2] + sz], [a[0] + sx, a[1] + r, a[2] + sz]], col);
}
