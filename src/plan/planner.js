import { VERTS, vAdj, vCells, vFixed } from '../core/grid.js';
import { has, topOf } from '../core/model.js';
import { hash, l2 } from '../core/util.js';

import { feature, rulesFor } from '../features/index.js';
import { WALK, analyseWalks, edgeKey, groundKind, houseType, isOpen, sideContext, sideKey } from './analysis.js';
import { houses } from './houses.js';
import { STYLES } from './styles.js';

// ---------- L0: scene planner ----------
// Details are not rolled where they are drawn. Once per rebuild the planner reads the scene's structure
// (what each street tile is, what each wall looks out onto, what kind of house it belongs to) and runs a
// small rule table, one rule per feature module (src/features). Each rule says where a feature may go, what it needs, how many a house may have and
// how far apart they must be; slots are reserved so features never collide. Drawing code only draws
// what the plan says, and every placement keeps the reason it was made.
// the rule tables, read from the feature registry in its order (lazily: features import the plan)
let RULES = null;
const rules = () => RULES || (RULES = { side: rulesFor('side'), overlay: rulesFor('overlay'), node: rulesFor('node'),
  edge: rulesFor('edge'), boathouse: rulesFor('boathouse') });
export let PLAN = { side: new Map(), over: new Map(), node: new Map(), edge: new Map(), log: [], issues: [] };
export function planScene() {
  PLAN = { side: new Map(), over: new Map(), node: new Map(), edge: new Map(), log: [], issues: [] };
  const R = rules();
  const note = (kind, at, why) => PLAN.log.push({ kind, at, why });
  for (const h of houses) {
    h.type = houseType(h);
    const st = STYLES[h.type], r = k => hash(h.anchor, 0, 81, k);
    h.style = st;
    h.roof = st.roofs[Math.floor(r(1) * st.roofs.length)];
    h.shutters = r(2) < st.shutters; h.flowers = r(3) < st.flowers; h.balcony = st.balcony * (0.5 + r(4));
    h.windows = r(5) < st.pairs ? 'pair' : 'joint'; h.head = st.heads[0] + (st.heads[1] - st.heads[0]) * r(6);
    h.planters = r(7) < st.planters; h.ivy = r(8) < st.ivy; h.shop = r(9) < st.shop;
    const byHeight = h.cols.slice().sort((a, b) => topOf(b) - topOf(a) || hash(a, 0, 42, 1) - hash(b, 0, 42, 1));
    h.chimneys = new Set(byHeight.slice(0, Math.min(st.chimneys, h.cols.length)));
    h.doors = new Map();
    const sides = [];
    for (const v of h.cols) for (const n of vAdj[v]) for (let y = 1; y <= topOf(v); y++) {
      if (has(v, y)) sides.push({ v, n, y, ctx: sideContext(v, n, y) });
    }
    const apply = (rule, map) => {
      if (rule.types && !rule.types.includes(h.type)) return;
      if (rule.when && !rule.when(h)) return;
      const salt = rule.kind.charCodeAt(0) * 7 + rule.kind.length;
      const cands = sides.filter(sd => rule.at(sd.v, sd.y) && rule.ctx(sd.ctx)
        && (!rule.grounded || has(sd.v, 0)) && !map.has(sideKey(sd.v, sd.n, sd.y)) && (!rule.needs || rule.needs(sd.v, sd.n)))
        .sort((a, b) => hash(h.anchor, a.v * 64 + a.y, a.n, salt) - hash(h.anchor, b.v * 64 + b.y, b.n, salt));
      let count = 0;
      for (const sd of cands) {
        if (count >= rule.max(h)) break;
        if (hash(h.anchor, sd.v * 64 + sd.y, sd.n, salt + 1) > rule.p(h)) continue;
        const key = sideKey(sd.v, sd.n, sd.y), extra = rule.claims ? rule.claims(sd.v, sd.n) : [];
        if (map.has(key) || extra.some(k => map.has(k))) continue;
        map.set(key, rule.kind);
        for (const k of extra) map.set(k, rule.kind + 'Top');
        if (rule.onPlace) rule.onPlace(h, sd);
        note(rule.kind, key, rule.why);
        count++;
      }
    };
    for (const rule of R.side) apply(rule, PLAN.side);
    // the foot of a wall that a door, staircase or shopfront already uses stays clear: no ivy, woodpile or
    // barrels in front of an entrance
    for (const rule of R.overlay) apply({ ...rule, needs: (v, n) => !PLAN.side.has(sideKey(v, n, 1)) && (!rule.needs || rule.needs(v, n)) }, PLAN.over);
  }
  // open ground. The walking network comes first (doors and stairs are known by now), then quay edges,
  // then tiles, so a tile prop can keep clear of a water stair or a bench on its edge
  const open = [], fronts = [];
  for (let v = 0; v < VERTS.length; v++) if (!vFixed[v] && isOpen(v)) open.push(v);
  for (const [key, kind] of PLAN.side) if (kind === 'door' || kind === 'stairs') fronts.push(+key.split('>')[1].split(':')[0]);
  const edges = [];
  for (const v of open) for (const n of vAdj[v]) if (!has(n, 0)) {
    const shared = vCells[v].map(([ci]) => ci).filter(ci => vCells[n].some(([cj]) => cj === ci));
    if (shared.length) edges.push({ v, n, cell: Math.min(...shared), mid: l2(VERTS[v], VERTS[n], 0.5) });
  }
  analyseWalks(open, fronts);
  for (const rule of R.edge) {
    const placed = [], salt = rule.kind.charCodeAt(0);
    const cands = edges.filter(e => !PLAN.edge.has(edgeKey(e.v, e.n)) && (!rule.needs || rule.needs(e.v, e.n)))
      .sort((a, b) => hash(a.v, a.n, 73, salt) - hash(b.v, b.n, 73, salt));
    for (const e of cands) {
      if (hash(e.v, e.n, 74, salt) > rule.p) continue;
      if (placed.some(q => Math.hypot(q[0] - e.mid[0], q[1] - e.mid[1]) < rule.spacing)) continue;
      placed.push(e.mid); PLAN.edge.set(edgeKey(e.v, e.n), { kind: rule.kind, cell: e.cell }); note(rule.kind, 'edge ' + edgeKey(e.v, e.n), rule.why);
      if (rule.opens) WALK.front.add(e.v);
    }
  }
  // rules that share a group (spans across a lane) keep their spacing from each other, not just from their own kind
  const placedIn = new Map();
  for (const rule of R.node) {
    const group = rule.group || rule.kind, placed = placedIn.get(group) || placedIn.set(group, []).get(group), salt = rule.kind.charCodeAt(0);
    const cands = open.filter(v => !PLAN.node.has(v) && rule.ctx(groundKind(v)) && (!rule.needs || rule.needs(v)))
      .sort((a, b) => hash(a, 0, 71, salt) - hash(b, 0, 71, salt));
    for (const v of cands) {
      if (hash(v, 0, 72, salt) > rule.p) continue;
      const P = VERTS[v];
      if (placed.some(q => Math.hypot(q[0] - P[0], q[1] - P[1]) < rule.spacing)) continue;
      placed.push(P); PLAN.node.set(v, rule.kind); note(rule.kind, 'tile ' + v, rule.why);
    }
  }
  // a street-level floor over open water shelters something under its arch: a boathouse
  for (const rule of R.boathouse) for (let v = 0; v < VERTS.length; v++) {
    if (has(v, 1) && !has(v, 0) && !vFixed[v] && hash(v, 1, 47, 1) < rule.p) { PLAN.node.set(v, rule.kind); note(rule.kind, 'tile ' + v, rule.why); }
  }
  validatePlan();
}
// the validator re-checks every placement against the rules' intent and reports anything illogical
export function validatePlan() {
  for (const [key, kind] of PLAN.side) {
    const f = feature.get(kind), [vn, y] = key.split(':'), [v, n] = vn.split('>').map(Number);
    const issue = f && f.check && f.check(v, n, +y, kind);
    if (issue) PLAN.issues.push(issue + ' at ' + key);
  }
  for (const [v, kind] of PLAN.node) {
    const f = feature.get(kind), issue = f && f.check && f.check(v);
    if (issue) PLAN.issues.push(issue + ' at tile ' + v);
  }
  for (const [key, e] of PLAN.edge) {
    const f = feature.get(e.kind), [v, n] = key.split('~').map(Number), issue = f && f.check && f.check(v, n);
    if (issue) PLAN.issues.push(issue + ' at edge ' + key);
  }
}
