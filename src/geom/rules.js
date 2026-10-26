import { GROUND, RISE, WATER } from '../core/dims.js';
import { UVM, VERTS, cells, vAdj, vCells, xz } from '../core/grid.js';
import { has, keyOf } from '../core/model.js';
import { hash, norm2, sub2 } from '../core/util.js';
import { houseOf } from '../plan/houses.js';
import { styleOf } from '../plan/styles.js';

// ---------- M5: corner-based architecture ----------
export const onStreet = (v, y) => y === 1 && has(v, 0);
// where a floor with nothing directly under it can rest its piers: the next floor down, the street, or the sea bed
export function supportBase(v, y) {
  for (let k = y - 1; k >= 0; k--) if (has(v, k)) return k + 1;
  return WATER - 0.35;
}

export let doorCache = new Map(), isoCache = new Map(), gableCache = new Map(), stairCache = new Map();
export function isolated(v, y) {
  const k = keyOf(v, y);
  if (!isoCache.has(k)) isoCache.set(k, !vAdj[v].some(n => has(n, y)));
  return isoCache.get(k);
}
export function doorOf(v) {
  const h = houseOf(v);
  return h && h.doors.has(v) ? h.doors.get(v) : -1;
}
// gable ends: the neighbours whose shared wall rises into a gable instead of a hipped slope.
// A lone low house becomes a gabled cottage; the last house of a row often ends in a gable.
export const dirTo = (a, b) => norm2(sub2(VERTS[b], VERTS[a]));
export function gableOf(v, y) {
  const key = keyOf(v, y);
  if (gableCache.has(key)) return gableCache.get(key);
  let out = [];
  if (!has(v, y + 1)) {
    const conn = vAdj[v].filter(n => has(n, y)), open = vAdj[v].filter(n => !has(n, y));
    const tower = y >= 2 && has(v, y - 1);
    const gp = styleOf(v).gable;
    if (conn.length === 0 && !tower && open.length >= 2 && hash(v, y, 17, 1) < gp[0]) {
      // pick the most opposite pair of neighbours as the ridge axis
      let best = -2, pair = null;
      for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) {
        const da = dirTo(v, open[i]), db = dirTo(v, open[j]), d = -(da[0] * db[0] + da[1] * db[1]);
        if (d > best) { best = d; pair = [open[i], open[j]]; }
      }
      if (pair && best > 0.5) out = pair;
    } else if (conn.length === 1 && hash(v, y, 17, 2) < gp[1]) {
      const back = dirTo(conn[0], v);
      let best = 0.55, u = -1;
      for (const n of open) { const d = dirTo(v, n), dot = d[0] * back[0] + d[1] * back[1]; if (dot > best) { best = dot; u = n; } }
      if (u >= 0) out = [u];
    }
  }
  gableCache.set(key, out);
  return out;
}
export const isGable = (v, y, u) => gableOf(v, y).includes(u);
// corner rounding is a per-house trait, constant up the whole column
export function roundOf(v, y) {
  if (y >= 2 && isolated(v, y)) return gableOf(v, y).length ? 0.07 : 0.42;
  if (y === 1 && isolated(v, y) && gableOf(v, y).length) return 0.07;
  return [0.07, 0.2, 0.26, 0.36][Math.floor(hash(v, 0, 9, 9) * 4)];
}
// A wall side between house corner v and open corner n is drawn by the two cells that share the edge v-n,
// each from the joint (the edge midpoint) to where its corner starts to round. Windows, doors, dormers and
// shops centred on the joint are drawn as two halves, so both must agree on what fits: this is the
// shorter of the two straight lengths, the one both halves use.
export function jointHalf(v, n, y) {
  let L = Infinity;
  for (const [ci, k] of vCells[v]) {
    const cell = cells[ci], vv = cell.v, e = vv[(k + 1) & 3] === n ? k : vv[(k + 3) & 3] === n ? (k + 3) & 3 : -1;
    if (e < 0) continue;
    // corner v is rounded in this cell when its other neighbour in the cell is empty too
    const w = vv[(k + 1) & 3] === n ? vv[(k + 3) & 3] : vv[(k + 1) & 3], convex = has(v, y) && !has(w, y) && !has(n, y);
    const M = xz(cell, UVM[e][0], UVM[e][1]), C = cell.c, t = convex ? roundOf(v, y) : 0;
    L = Math.min(L, Math.hypot(M[0] - (C[0] + (M[0] - C[0]) * t), M[1] - (C[1] + (M[1] - C[1]) * t)));
  }
  return L;
}
export function apexOf(v, y) {
  const Hr = y + 1 + RISE;
  if (!isolated(v, y) || gableOf(v, y).length) return Hr;
  const r = hash(v, y, 11, 3);
  return y >= 2 && has(v, y - 1) ? Hr + 0.4 + r * 0.5 : Hr + r * 0.2;
}
export const toneOf = (v, y) => 0.95 + hash(v, y, 1, 1) * 0.08;

export const isStilted = (v, y) => y >= 2 && supportBase(v, y) < GROUND && hash((houseOf(v) || { anchor: v }).anchor, 0, 45, 1) < 0.5;
// a tall lone tower (five floors or more) usually becomes a lighthouse instead of taking a spire
export const isLighthouse = (v, y) => y >= 4 && has(v, y - 1) && isolated(v, y) && !gableOf(v, y).length && hash(v, 0, 43, 1) < 0.7;
export function resetCaches() { doorCache = new Map(); isoCache = new Map(); gableCache = new Map(); stairCache = new Map(); }
