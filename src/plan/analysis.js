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

// ---------- walking network ----------
// Open tiles joined along their sides are the walkways. A tile is on a route when the network splits
// without it (a lane, a pier, the neck between two squares) or when something opens onto it (a door,
// the foot of an exterior stair, a water stair). A tile has an interior when it is open on every side,
// so something standing in its middle leaves room to walk around. Props keep off routes.
export let WALK = { route: new Set(), front: new Set() };
export const hasInterior = v => vAdj[v].every(isOpen);
export const onRoute = v => WALK.route.has(v);
export function analyseWalks(open, fronts) {
  const inOpen = new Set(open), depth = new Map(), low = new Map(), route = new Set(fronts);
  // articulation points of the open-tile graph (iterative Tarjan)
  for (const root of open) {
    if (depth.has(root)) continue;
    depth.set(root, 0); low.set(root, 0);
    let rootKids = 0;
    const stack = [[root, -1, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1], [v, parent] = top, nb = vAdj[v];
      if (top[2] < nb.length) {
        const n = nb[top[2]++];
        if (!inOpen.has(n) || n === parent) continue;
        if (depth.has(n)) { low.set(v, Math.min(low.get(v), depth.get(n))); continue; }
        depth.set(n, depth.get(v) + 1); low.set(n, depth.get(n));
        if (v === root) rootKids++;
        stack.push([n, v, 0]);
      } else {
        stack.pop();
        if (parent >= 0) {
          low.set(parent, Math.min(low.get(parent), low.get(v)));
          if (parent !== root && low.get(v) >= depth.get(parent)) route.add(parent);
        }
      }
    }
    if (rootKids > 1) route.add(root);
  }
  WALK = { route, front: new Set(fronts) };
}
// how squarely a direction from tile v crosses the walking directions out of it: 0 means straight across
// the path (the kerb side), 1 means along it (into the way)
export function alongPath(v, dir) {
  let worst = 0;
  for (const o of vAdj[v]) if (isOpen(o)) {
    const d = norm2(sub2(VERTS[o], VERTS[v]));
    worst = Math.max(worst, Math.abs(d[0] * dir[0] + d[1] * dir[1]));
  }
  return worst;
}
