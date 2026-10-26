import { GRID_SEED, GRID_VERSION, HEX_N, TRI_SIDE } from './palette.js';
import { mulberry32 } from './util.js';

// ---------- M1: organic grid (hex → triangles → quads → subdivide → relax) ----------
export function generateGrid(seed, N, L, version = GRID_VERSION) {
  const rnd = mulberry32(seed);
  const V = [], idx = new Map(), id = (i, j) => i + ',' + j;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    if (Math.max(Math.abs(i), Math.abs(j), Math.abs(i + j)) > N) continue;
    idx.set(id(i, j), V.length);
    V.push([L * (i + 0.5 * j), L * (j * Math.sqrt(3) / 2)]);
  }
  const tris = [];
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const a = idx.get(id(i, j)), b = idx.get(id(i + 1, j)), c = idx.get(id(i, j + 1)), d = idx.get(id(i + 1, j + 1));
    if (a != null && b != null && c != null) tris.push([a, b, c]);
    if (b != null && d != null && c != null) tris.push([b, d, c]);
  }
  const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  const edgeTris = new Map();
  tris.forEach((t, ti) => { for (let k = 0; k < 3; k++) { const e = ek(t[k], t[(k + 1) % 3]); if (!edgeTris.has(e)) edgeTris.set(e, []); edgeTris.get(e).push(ti); } });
  // pair triangles into quads. The current grid takes the triangle with the fewest free neighbours first,
  // so almost every triangle finds a partner: fewer lone triangles means fewer small, odd-shaped build
  // targets and corners where three or five streets meet. The first grid (version 1) paired in random
  // order; it is kept only to carry saved towns over.
  const used = new Uint8Array(tris.length), polys = [];
  const free = ti => { const t = tris[ti], o = []; for (let k = 0; k < 3; k++) for (const tj of edgeTris.get(ek(t[k], t[(k + 1) % 3]))) if (tj !== ti && !used[tj]) o.push([k, tj]); return o; };
  const pairUp = (ti, p) => {
    const t = tris[ti], opts = free(ti);
    if (opts.length && rnd() < p) {
      const [k, tj] = opts[Math.floor(rnd() * opts.length)];
      const B = t[k], Cc = t[(k + 1) % 3], A = t[(k + 2) % 3];
      const D = tris[tj].find(v => v !== B && v !== Cc);
      polys.push([A, B, D, Cc]);
      used[ti] = used[tj] = 1;
    } else { polys.push(t.slice()); used[ti] = 1; }
  };
  if (version === 1) {
    const order = tris.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const ti of order) if (!used[ti]) pairUp(ti, 0.9);
  } else {
    const key = tris.map(() => rnd());
    for (;;) {
      let ti = -1, best = Infinity;
      for (let i = 0; i < tris.length; i++) if (!used[i]) { const n = free(i).length + key[i]; if (n < best) { best = n; ti = i; } }
      if (ti < 0) break;
      pairUp(ti, 0.97);
    }
  }
  const mids = new Map();
  const midOf = (a, b) => { const k = ek(a, b); if (!mids.has(k)) { mids.set(k, V.length); V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]); } return mids.get(k); };
  const quads = [];
  for (const p of polys) {
    const n = p.length; let cx = 0, cy = 0;
    for (const v of p) { cx += V[v][0]; cy += V[v][1]; }
    const m = V.length; V.push([cx / n, cy / n]);
    const e = p.map((v, k) => midOf(v, p[(k + 1) % n]));
    for (let k = 0; k < n; k++) quads.push([p[k], e[k], m, e[(k - 1 + n) % n]]);
  }
  // boundary vertices stay put during relaxation
  const edgeCount = new Map();
  for (const q of quads) for (let k = 0; k < 4; k++) { const e = ek(q[k], q[(k + 1) % 4]); edgeCount.set(e, (edgeCount.get(e) || 0) + 1); }
  const fixed = new Uint8Array(V.length);
  for (const [e, n] of edgeCount) if (n === 1) { const [a, b] = e.split('_').map(Number); fixed[a] = fixed[b] = 1; }
  // relax: pull every quad toward the best-fit square (Stålberg's method). The square is also scaled
  // toward one common size, so quads cut from single triangles (otherwise 2/3 the size of the rest)
  // grow to match and every build target is about as easy to hit as its neighbours.
  const area = q => { let s = 0; for (let k = 0; k < 4; k++) { const a = V[q[k]], b = V[q[(k + 1) % 4]]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const R0 = Math.sqrt(quads.reduce((s, q) => s + area(q), 0) / quads.length / 2);   // half-diagonal of the mean square
  const F = V.map(() => [0, 0]);
  for (let it = 0, n = version === 1 ? 90 : 160; it < n; it++) {
    for (const f of F) { f[0] = 0; f[1] = 0; }
    for (const q of quads) {
      let cx = 0, cy = 0;
      for (const v of q) { cx += V[v][0]; cy += V[v][1]; }
      cx /= 4; cy /= 4;
      let ax = 0, ay = 0;
      for (let k = 0; k < 4; k++) {
        let x = V[q[k]][0] - cx, y = V[q[k]][1] - cy;
        for (let r = 0; r < k; r++) { const t = x; x = y; y = -t; }
        ax += x; ay += y;
      }
      let x = ax / 4, y = ay / 4;
      const r = Math.hypot(x, y) || 1, sc = version === 1 ? 1 : 1 + (R0 / r - 1) * 0.6;
      x *= sc; y *= sc;
      for (let k = 0; k < 4; k++) {
        F[q[k]][0] += cx + x - V[q[k]][0];
        F[q[k]][1] += cy + y - V[q[k]][1];
        const t = x; x = -y; y = t;
      }
    }
    for (let i = 0; i < V.length; i++) if (!fixed[i]) { V[i][0] += F[i][0] * 0.14; V[i][1] += F[i][1] * 0.14; }
  }
  const cells = quads.map(q => {
    const pts = q.map(i => V[i]);
    return { v: q, q: pts, c: [(pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4, (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4], nb: [-1, -1, -1, -1], ne: [-1, -1, -1, -1], len: [0, 1, 2, 3].map(k => Math.hypot(pts[(k + 1) % 4][0] - pts[k][0], pts[(k + 1) % 4][1] - pts[k][1])) };
  });
  const edgeOwner = new Map();
  cells.forEach((cell, ci) => {
    for (let k = 0; k < 4; k++) {
      const e = ek(cell.v[k], cell.v[(k + 1) % 4]);
      if (edgeOwner.has(e)) {
        const [cj, kj] = edgeOwner.get(e);
        cell.nb[k] = cj; cell.ne[k] = kj; cells[cj].nb[kj] = ci; cells[cj].ne[kj] = k;
      } else edgeOwner.set(e, [ci, k]);
    }
  });
  return { cells, V, edges: [...edgeCount.keys()].map(e => e.split('_').map(Number)) };
}

export const GRID = generateGrid(GRID_SEED, HEX_N, TRI_SIDE);
export const cells = GRID.cells;
cells.forEach((c, i) => { c.i = i; });

// vertex topology: houses live on grid corners (Townscaper's dual grid)
export const VERTS = GRID.V;
export const vAdj = VERTS.map(() => []);
for (const [a, b] of GRID.edges) { vAdj[a].push(b); vAdj[b].push(a); }
export const vCells = VERTS.map(() => []);
cells.forEach((c, ci) => c.v.forEach((v, k) => vCells[v].push([ci, k])));
export const vFixed = VERTS.map(v => 0);
for (const [a, b] of GRID.edges) {
  // an edge used by a single cell lies on the outer boundary
  const shared = vCells[a].filter(([ci]) => vCells[b].some(([cj]) => cj === ci)).length;
  if (shared < 2) vFixed[a] = vFixed[b] = 1;
}
export function vertexAt(x, z, maxD = 0.9) {
  let best = -1, bd = maxD * maxD;
  for (let i = 0; i < VERTS.length; i++) {
    if (vFixed[i]) continue;
    const dx = VERTS[i][0] - x, dz = VERTS[i][1] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// The build target under a point on the water: the corner whose footprint contains it. A corner's
// footprint is made of one quarter of each cell around it (corner, edge midpoint, cell centre, edge
// midpoint), the same shape the hover preview and the water grid lines show. `hub` is how close the point
// is to the cell centre, where four footprints meet (0 at the centre, about 1 at the corners).
const inPoly = (P, x, z) => {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if ((P[i][1] > z) !== (P[j][1] > z) && x < P[j][0] + (P[i][0] - P[j][0]) * (z - P[j][1]) / (P[i][1] - P[j][1])) inside = !inside;
  }
  return inside;
};
export function footprintAt(x, z) {
  for (const cell of cells) {
    if (!inPoly(cell.q, x, z)) continue;
    const C = cell.c, M = UVM.map(m => xz(cell, m[0], m[1]));
    for (let k = 0; k < 4; k++) {
      if (!inPoly([cell.q[k], M[k], C, M[pv4(k)]], x, z)) continue;
      const hub = Math.hypot(x - C[0], z - C[1]) / Math.hypot(cell.q[k][0] - C[0], cell.q[k][1] - C[1]);
      return { v: cell.v[k], cell, k, hub };
    }
  }
  return null;
}

export function W(cell, u, v, y) {
  const q = cell.q, a = (1 - u) * (1 - v), b = u * (1 - v), c = u * v, d = (1 - u) * v;
  return [a * q[0][0] + b * q[1][0] + c * q[2][0] + d * q[3][0], y, a * q[0][1] + b * q[1][1] + c * q[2][1] + d * q[3][1]];
}

export const UVM = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];   // edge midpoints in a cell's unit square
export const nx4 = k => (k + 1) & 3, pv4 = k => (k + 3) & 3;
export const xz = (cell, u, v) => { const p = W(cell, u, v, 0); return [p[0], p[2]]; };
