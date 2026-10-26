import { VERTS, vAdj } from '../core/grid.js';
import { has, topOf } from '../core/model.js';
import { norm2, sub2 } from '../core/util.js';

// ---------- scene analysis ----------
// What each street tile is, what each wall side looks out onto and what kind of house a house is.
// The planner's rules and the features' needs are written in these terms.
export const isOpen = v => has(v, 0) && !has(v, 1);
export function groundKind(v) {
  if (!has(v, 0)) return 'water';
  if (has(v, 1)) return 'built';
  const nb = vAdj[v];
  if (nb.length && nb.every(n => has(n, 1))) return 'courtyard';
  if (nb.some(n => !has(n, 0))) return 'quay';
  return nb.filter(isOpen).length >= 3 ? 'plaza' : 'lane';
}
// what the wall of corner v that faces corner n looks out onto at level y
export function sideContext(v, n, y) {
  if (has(n, y)) return 'interior';
  if (y === 1) return has(n, 0) ? groundKind(n) : 'water';
  if (has(n, y - 1)) return 'roof';
  return has(n, 0) ? 'over-street' : 'over-water';
}
export const WALKABLE = new Set(['lane', 'plaza', 'courtyard', 'quay']);
export const STREETS = c => c === 'lane' || c === 'plaza' || c === 'quay';
export function houseType(h) {
  const H = Math.max(...h.cols.map(topOf)), M = h.mass || { cols: h.cols.length, height: H };
  if (M.cols >= 3 && M.height <= 2) return 'warehouse';
  if (h.cols.length === 1 && M.cols <= 2 && H >= 3) return 'tower';
  if (H <= 1) return 'cottage';
  return 'townhouse';
}
export const sideKey = (v, n, y) => v + '>' + n + ':' + y;
export const edgeKey = (v, n) => v + '~' + n;
// two houses facing each other across a lane, tall enough to hang laundry between
export function lanePair(v) {
  const tall = vAdj[v].filter(n => has(n, 2));
  let pair = null, best = 0.6;
  for (let i = 0; i < tall.length; i++) for (let j = i + 1; j < tall.length; j++) {
    const da = norm2(sub2(VERTS[tall[i]], VERTS[v])), db = norm2(sub2(VERTS[tall[j]], VERTS[v])), d = -(da[0] * db[0] + da[1] * db[1]);
    if (d > best) { best = d; pair = [tall[i], tall[j]]; }
  }
  return pair;
}
