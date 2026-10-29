import { GROUND } from '../core/dims.js';
import { VERTS, cells, footprintAt, vAdj, vCells, vFixed, vertexAt } from '../core/grid.js';
import { has } from '../core/model.js';
import { FOLK } from '../core/palette.js';
import { hash, l2, smooth } from '../core/util.js';
import { isOpen } from './analysis.js';
import { houses } from './houses.js';

// ---------- townsfolk ----------
// The people of the town. Every house with a door is home to one or two of them. They step out of their
// door and go about errands that the town's details give them a reason for: a shop window to look in, a
// bench to sit on and watch the water, a stretch of railing to lean on, their boat to see to, a neighbour
// to visit, a stroll. Then they go home. Passers-by keep to the right, step aside for each other and stop
// for a chat when they meet; night empties the streets, and whoever is still out carries a lantern.
// Spots and obstacles come from the features themselves (bld.walk, recorded where they are drawn), so a new
// detail that offers somewhere to go is used without touching this file. All of it is plain data and
// deterministic (hash, never Math.random): the tests run the town for a minute in Node; fx/folk.js draws it.

export const BODY = 0.07;          // a walker's radius
const WALL_CLEAR = 0.15;           // how far walking lines keep from house walls and the quay edge
const STEP = 0.04;                 // path sample spacing
const MAX_FOLK = 40;
const FLOOR = GROUND + 0.015;      // the top of the paving
const INDOORS = -0.16;             // how far inside the wall face someone is when the door shuts behind them
const SWING = 0.4;                 // seconds for a door to swing open or shut

// The errands, in the planner's style: who goes (weight by persona), where (a kind of spot, or none), what
// they do there and for how long (seconds), how much night changes the wish (a factor), and why.
export const ERRANDS = [
  { kind: 'shop', spot: 'shop', pose: 'browse', stay: [3, 7], night: 0.15,
    w: { folk: 3, elder: 2, child: 0.6, fisher: 1 }, why: 'looks in a shop window and comes away with what it sells' },
  { kind: 'bench', spot: 'bench', pose: 'sit', stay: [9, 20], night: 0.5,
    w: { folk: 1.2, elder: 4, child: 0.5, fisher: 1 }, why: 'sits on a bench and watches the water' },
  { kind: 'quay', spot: 'quay', pose: 'gaze', stay: [4, 10], night: 0.7,
    w: { folk: 1.5, elder: 1, child: 2, fisher: 1.2 }, why: 'leans on the railing to look at the harbour' },
  { kind: 'mooring', spot: 'mooring', pose: 'tend', stay: [6, 14], night: 0.3,
    w: { folk: 0.2, elder: 0.4, child: 0.6, fisher: 6 }, why: 'sees to a boat at the water stairs or a berth' },
  { kind: 'visit', spot: 'door', pose: 'knock', stay: [1.2, 2], night: 0.4,
    w: { folk: 1.4, elder: 1.4, child: 1, fisher: 0.6 }, why: 'knocks at a neighbour\'s door and goes in for a while' },
  { kind: 'stroll', pose: 'look', stay: [1, 3], night: 0.8,
    w: { folk: 1.5, elder: 0.8, child: 3, fisher: 0.6 }, why: 'takes a turn round the streets and looks about' },
  { kind: 'home', spot: 'door', pose: 'knock', stay: [0.2, 0.5], night: 5,
    w: { folk: 1, elder: 1.4, child: 1, fisher: 1 }, why: 'goes home' },
];
// what a shopper carries away: a loaf from a baker, a basket from the fishmonger or the wine shop
const SHOP_GOODS = ['bread', 'basket', 'basket'];

// the tile a point stands on (a point exactly on a cell edge belongs to no cell's quarter: the nearest corner)
export const tileOf = (x, z) => { const f = footprintAt(x, z); return f ? f.v : vertexAt(x, z, 1); };
const dist = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const yawOf = d => Math.atan2(d[0], d[1]);   // a figure's forward is (sin yaw, cos yaw)
const turn = (a, b, k) => a + wrap(b - a) * Math.min(1, k);
// the closest point to (px, pz) on capsule c = [ax, az, bx, bz, r]
function closest(c, px, pz) {
  const dx = c[2] - c[0], dz = c[3] - c[1], L = dx * dx + dz * dz;
  const u = L > 1e-9 ? Math.max(0, Math.min(1, ((px - c[0]) * dx + (pz - c[1]) * dz) / L)) : 0;
  return [c[0] + dx * u, c[1] + dz * u];
}

// ---------- the walkable town ----------
// Open tiles joined along their sides, which of them reach each other, the line where each meets a wall or
// the quay edge, the obstacles details stand on the ground, and the spots they offer.
export function folkWorld(walk) {
  const open = new Set(), comp = new Map(), walls = new Map();
  for (let v = 0; v < VERTS.length; v++) if (!vFixed[v] && isOpen(v)) open.add(v);
  for (const v0 of open) {
    if (comp.has(v0)) continue;
    comp.set(v0, v0);
    const q = [v0];
    while (q.length) { const v = q.pop(); for (const n of vAdj[v]) if (open.has(n) && !comp.has(n)) { comp.set(n, v0); q.push(n); } }
  }
  // an open tile's ground ends where it meets a closed neighbour: on the line from their edge's midpoint to
  // the centre of each cell they share (where house walls and quay kerbs stand)
  for (const v of open) {
    const list = [];
    for (const b of vAdj[v]) if (!open.has(b)) {
      const m = l2(VERTS[v], VERTS[b], 0.5);
      for (const [ci] of vCells[v]) if (cells[ci].v.includes(b)) list.push([m[0], m[1], cells[ci].c[0], cells[ci].c[1], 0]);
    }
    walls.set(v, list);
  }
  const spots = [], byKey = new Map();
  for (const s of walk.spots) {
    if (!open.has(s.v)) continue;
    const key = s.kind + ':' + Math.round(s.x * 40) + ':' + Math.round(s.z * 40);
    if (byKey.has(key)) continue;
    const sp = { ...s, key, comp: comp.get(s.v), taken: -1 };
    spots.push(sp); byKey.set(key, sp);
  }
  // homes: one resident per house with a door, two in a house of three or more columns
  const homes = [];
  for (const h of houses) {
    const doors = spots.filter(s => s.kind === 'door' && h.cols.includes(s.home));
    if (!doors.length) continue;
    for (let k = 0; k < (h.cols.length >= 3 ? 2 : 1); k++) homes.push({ id: h.anchor * 4 + k, k, house: h, door: doors[k % doors.length] });
  }
  homes.sort((a, b) => hash(a.id, 0, 145, 1) - hash(b.id, 0, 145, 1));
  return { open, comp, walls, blocks: walk.blocks, spots, byKey, homes };
}

// shortest walk between two open tiles (A* over tile centres), or null when they don't connect
export function findPath(W, from, to) {
  if (!W.open.has(from) || !W.open.has(to) || W.comp.get(from) !== W.comp.get(to)) return null;
  const g = new Map([[from, 0]]), prev = new Map(), done = new Set(), heap = [[0, from]];
  const h = v => dist(VERTS[v][0], VERTS[v][1], VERTS[to][0], VERTS[to][1]);
  const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [, v] = pop();
    if (v === to) break;
    if (done.has(v)) continue;
    done.add(v);
    for (const n of vAdj[v]) {
      if (!W.open.has(n)) continue;
      const c = g.get(v) + dist(VERTS[v][0], VERTS[v][1], VERTS[n][0], VERTS[n][1]);
      if (c < (g.has(n) ? g.get(n) : Infinity)) { g.set(n, c); prev.set(n, v); push([c + h(n), n]); }
    }
  }
  if (!g.has(to)) return null;
  const out = [to];
  while (out[out.length - 1] !== from) out.push(prev.get(out[out.length - 1]));
  return out.reverse();
}

// A walking line from point `from` to point `to` through the tiles between them: through the tile centres,
// a lane's width to the right of them, corners rounded, then pushed clear of walls and of whatever stands on
// the ground. The ends are left where they are (a doorstep or a bench seat is meant to be close to things);
// with `free`, the end is pushed clear too (a spot picked in the open, not a place someone is meant to stand).
export function walkLine(W, from, to, lane, free = false) {
  const t0 = tileOf(from[0], from[1]), t1 = tileOf(to[0], to[1]);
  const tiles = findPath(W, W.open.has(t0) ? t0 : nearestOpen(W, from, W.comp.get(t1)), t1);
  if (!tiles) return null;
  const ctrl = tiles.map(t => VERTS[t]);
  // skip a tile's middle the walker is already past, or would have to come back from
  const back = (a, b, c) => (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) > 0;
  if (ctrl.length > 1 && back(from, ctrl[0], ctrl[1])) ctrl.shift();
  if (ctrl.length > 1 && back(to, ctrl[ctrl.length - 1], ctrl[ctrl.length - 2])) ctrl.pop();
  let pts = [from, ...ctrl, to].map((p, i, all) => {
    if (i === 0 || i === all.length - 1) return p.slice();
    const a = all[i - 1], b = all[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - dz / l * lane, p[1] + dx / l * lane];
  });
  for (let k = 0; k < 3; k++) {
    const q = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) q.push(l2(pts[i], pts[i + 1], 0.25), l2(pts[i], pts[i + 1], 0.75));
    q.push(pts[pts.length - 1]);
    pts = q;
  }
  // even spacing
  const x = [from[0]], z = [from[1]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = dist(ax, az, bx, bz);
    let s = STEP - carry;
    for (; s < L; s += STEP) { x.push(ax + (bx - ax) * s / L); z.push(az + (bz - az) * s / L); }
    carry = L - (s - STEP);
  }
  x.push(to[0]); z.push(to[1]);
  // keep clear of the walls of every tile on the way and its neighbours, and of the obstacles near the line
  const near = new Set();
  for (const t of tiles) { near.add(t); for (const n of vAdj[t]) if (W.open.has(n)) near.add(n); }
  const caps = [];
  for (const t of near) for (const w of W.walls.get(t)) caps.push([w, WALL_CLEAR]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < x.length; i++) { x0 = Math.min(x0, x[i]); x1 = Math.max(x1, x[i]); z0 = Math.min(z0, z[i]); z1 = Math.max(z1, z[i]); }
  for (const b of W.blocks) {
    if (Math.max(b[0], b[2]) < x0 - 0.6 || Math.min(b[0], b[2]) > x1 + 0.6 || Math.max(b[1], b[3]) < z0 - 0.6 || Math.min(b[1], b[3]) > z1 + 0.6) continue;
    caps.push([b, b[4] + BODY]);
  }
  const n = x.length, total = (n - 1) * STEP;
  const weight = i => { const s = i * STEP; return smooth(Math.min(1, Math.max(0, (Math.min(s, free ? Infinity : total - s) - 0.04) / 0.26))); };
  for (let it = 0; it < 4; it++) {
    for (let i = 1; i < n - (free ? 0 : 1); i++) {
      const w = weight(i);
      if (!w) continue;
      for (const [c, need] of caps) {
        const [cx, cz] = closest(c, x[i], z[i]), dx = x[i] - cx, dz = z[i] - cz, d = Math.hypot(dx, dz);
        if (d < need && d > 1e-6) { x[i] += dx / d * (need - d) * w; z[i] += dz / d * (need - d) * w; }
      }
    }
    // a light smoothing pass so the pushes don't leave kinks
    for (let i = 1; i < n - 1; i++) { x[i] = x[i] * 0.5 + (x[i - 1] + x[i + 1]) * 0.25; z[i] = z[i] * 0.5 + (z[i - 1] + z[i + 1]) * 0.25; }
  }
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(x[i - 1], z[i - 1], x[i], z[i]));
  return { x, z, cum, len: cum[n - 1], tiles, i: 0 };
}
// position and heading at distance s along a line (the line remembers where it was last read)
function along(P, s) {
  while (P.i < P.x.length - 2 && P.cum[P.i + 1] < s) P.i++;
  const i = P.i, seg = P.cum[i + 1] - P.cum[i] || 1, u = Math.max(0, Math.min(1, (s - P.cum[i]) / seg));
  const dx = P.x[i + 1] - P.x[i], dz = P.z[i + 1] - P.z[i], l = Math.hypot(dx, dz) || 1;
  return [P.x[i] + dx * u, P.z[i] + dz * u, dx / l, dz / l];
}
function nearestOpen(W, p, comp) {
  let best = -1, bd = 2.2;
  for (const v of W.open) {
    if (comp !== undefined && W.comp.get(v) !== comp) continue;
    const d = dist(p[0], p[1], VERTS[v][0], VERTS[v][1]);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

// ---------- who they are ----------
// A resident's persona, size, pace and clothes follow from their house: fisherfolk live by the water, a
// house of two may have a child in it. Clothes are the town's pastels a shade deeper.
function makePerson(home) {
  const id = home.id, r = k => hash(id, k, 141, 7), h = home.house;
  const pick = (arr, k) => arr[Math.floor(r(k) * arr.length)];
  const byWater = h.cols.some(v => vAdj[v].some(n => !has(n, 0)));
  const persona = r(1) < (byWater ? 0.4 : h.type === 'warehouse' ? 0.3 : 0.05) ? 'fisher'
    : home.k > 0 && r(2) < 0.5 ? 'child' : r(2) < 0.2 ? 'elder' : 'folk';
  const fisher = persona === 'fisher', elder = persona === 'elder', child = persona === 'child';
  const hat = fisher ? 'souwester' : r(10) < (elder ? 0.7 : child ? 0.15 : 0.3) ? pick(['straw', 'cap', 'beret'], 11) : null;
  const look = {
    coat: fisher ? FOLK.oilskin : pick(FOLK.coats, 3), legs: pick(FOLK.trousers, 4), skin: pick(FOLK.skin, 5),
    hair: elder ? pick(FOLK.grey, 6) : pick(FOLK.hair, 6), hairStyle: pick(['short', 'short', 'bun', 'long'], 7),
    skirt: !fisher && r(8) < 0.4 ? pick(FOLK.skirts, 9) : null,
    hat, hatCol: fisher ? FOLK.oilskin : hat === 'straw' ? '#e9d29a' : pick(FOLK.hats, 12),
  };
  const pace = { folk: 0.36, elder: 0.24, child: 0.44, fisher: 0.34 }[persona] * (0.9 + 0.2 * r(13));
  return {
    id, home: home.door.key, house: h.anchor, persona, look, size: child ? 0.66 : 0.92 + 0.14 * r(14), pace,
    lane: 0.04 + 0.04 * r(15), n: 0,
    st: 'inside', at: home.door.key, until: 0, t0: 0, x: home.door.x, z: home.door.z, y: FLOOR,
    yaw: yawOf(home.door.dir), vis: 0, v: 0, side: 0, phase: r(16) * 6.28, gait: 0, sit: 0, bend: 0, gesture: 0,
    head: 0, nod: 0, hop: 0, carry: null, lantern: false, task: null, path: null, s: 0, mate: -1, cool: 0, gone: false,
    door: 0, dim: 0, way: null,
  };
}
const rnd = (p, salt) => hash(p.id, p.n++, salt, 142);

// ---------- the town's people over time ----------
export function makeFolk() { return { t: 0, people: [], world: null, fresh: true, log: [] }; }

// After every rebuild: the walkable town has changed, so residents move in or out with their houses,
// anyone standing where a block now stands hops aside, and every walk is planned again on the new streets.
export function syncFolk(F, walk, cap = MAX_FOLK) {
  const W = folkWorld(walk), was = new Map(F.people.map(p => [p.id, p]));
  F.world = W;
  const people = [];
  for (const home of W.homes.slice(0, cap)) {
    let p = was.get(home.id);
    if (p) {
      was.delete(home.id); p.home = home.door.key;
      // a house taken away and put back before its resident was out of sight: they stay
      if (p.gone) {
        p.gone = false;
        if (p.st === 'vanish') { p.task = null; Object.assign(p, { st: 'look', vis: 1, until: F.t, t0: F.t }); }
      }
    } else {
      p = makePerson(home);
      // a new house's people come out soon after it is built; on the first load, most are already out
      if (F.fresh && hash(p.id, 0, 146, 1) < 0.65) {
        const start = W.spots.filter(s => s.comp === home.door.comp && (s.kind === 'quay' || s.kind === 'shop' || s.kind === 'mooring'));
        const s0 = start[Math.floor(hash(p.id, 0, 146, 2) * start.length)] || home.door;
        Object.assign(p, { st: 'look', x: s0.x, z: s0.z, vis: 1, until: F.t + hash(p.id, 0, 146, 3) * 2, t0: F.t });
      } else p.until = F.t + (F.fresh ? 1 + 12 * hash(p.id, 0, 146, 4) : 1.2 + 3 * hash(p.id, 0, 146, 5));
    }
    people.push(p);
  }
  // residents whose house is gone (or who no longer fit) leave: indoors at once, outdoors with a little pop
  for (const p of was.values()) if (p.st !== 'inside') { p.gone = true; leave(p, F.t); people.push(p); }
  F.people = people;
  F.fresh = false;
  for (const p of people) {
    // a doorway built over while someone was in it: they are indoors
    if ((p.st === 'enter' || p.st === 'emerge') && !W.byKey.has(p.at)) Object.assign(p, { st: 'inside', vis: 0, door: 0, task: null, until: F.t + 2 });
    if (!W.byKey.has(p.at)) p.at = p.home;
    if (p.task && p.task.spot) {
      const sp = W.byKey.get(p.task.spot.key);
      if (sp) { p.task.spot = sp; sp.taken = p.id; } else if (!indoors(p)) drop(F, p);
    }
    if (indoors(p) || p.gone) continue;
    const t = tileOf(p.x, p.z);
    if (!W.open.has(t)) {
      // the ground went from under them: a hop to the nearest street, or home if there is none
      const to = nearestOpen(W, [p.x, p.z]);
      if (to < 0) { leave(p, F.t); continue; }
      Object.assign(p, { st: 'hop', from: [p.x, p.z], to: VERTS[to].slice(), t0: F.t, sit: 0, mate: -1 });
      if (p.task && p.task.spot) p.task.spot.taken = -1;
      p.task = null;
    } else if (p.st === 'walk' || p.st === 'chat') {
      // a walk goes on by the new streets, and so does one paused for a chat, once the chat is over
      const { st, mate } = p;
      go(F, p, p.task);
      if (st === 'chat' && p.st === 'walk') Object.assign(p, { st, mate });
    }
  }
}
// in, or on the way in or out through a doorway, or popping out of sight: not standing on the street
const indoors = p => p.st === 'inside' || p.st === 'enter' || p.st === 'emerge' || p.st === 'vanish';
// gone at once where they stand: their house was taken away, or there is no street left to stand on
function leave(p, t) { p.st = 'vanish'; p.t0 = t; p.mate = -1; if (p.task && p.task.spot) p.task.spot.taken = -1; }
// give up the current errand where they stand
function drop(F, p) {
  if (p.task && p.task.spot) p.task.spot.taken = -1;
  p.task = null; p.mate = -1;
  Object.assign(p, { st: 'look', until: F.t + 0.8, t0: F.t });
}

// choose the next errand: the table's weights, scaled by the hour and by what the person has just done
function nextTask(F, p, night) {
  const W = F.world, home = W.byKey.get(p.home), comp = W.comp.get(tileOf(p.x, p.z));
  const opts = [];
  for (const e of ERRANDS) {
    let w = e.w[p.persona] * (1 + (e.night - 1) * night);
    if (e.kind === 'home') {
      if (!home || home.comp !== comp) continue;
      if (p.carry || p.at !== p.home) w *= 3;
      opts.push([w, e, home]);
      continue;
    }
    if (e.kind === 'stroll') {
      const tiles = [...W.open].filter(v => W.comp.get(v) === comp);
      const v = tiles[Math.floor(rnd(p, 147) * tiles.length)];
      if (v !== undefined) opts.push([w, e, { x: VERTS[v][0], z: VERTS[v][1], free: true }]);
      continue;
    }
    // the spot: one that is free, in reach, nearer ones likelier; never one's own door to visit
    const cands = W.spots.filter(s => s.kind === e.spot && s.comp === comp && s.taken < 0 && !(e.kind === 'visit' && s.key === p.home));
    if (!cands.length) continue;
    const ws = cands.map(s => 1 / (1 + ((s.x - p.x) ** 2 + (s.z - p.z) ** 2) / 9));
    let r = rnd(p, 148) * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < cands.length - 1 && (r -= ws[i]) > 0) i++;
    opts.push([w, e, cands[i]]);
  }
  if (!opts.length) return null;
  let r = rnd(p, 149) * opts.reduce((a, o) => a + o[0], 0), k = 0;
  while (k < opts.length - 1 && (r -= opts[k][0]) > 0) k++;
  const [, e, target] = opts[k];
  return { kind: e.kind, pose: e.pose, stay: e.stay, spot: target.key ? target : null, x: target.x, z: target.z, free: !!target.free };
}
// set off toward a task's spot (or the last step before it)
function go(F, p, task) {
  const sp = task.spot, to = sp && sp.via ? sp.via : [task.x, task.z];
  const path = walkLine(F.world, [p.x, p.z], to, p.lane, task.free);
  if (!path) { drop(F, p); return; }
  if (sp) sp.taken = p.id;
  Object.assign(p, { task, path, s: 0, st: 'walk', mate: -1 });
}

// One step of everyone's life. `night` runs from 0 (day) to 1 (night).
export function stepFolk(F, dt, night = 0) {
  F.t += dt;
  const t = F.t, P = F.people;
  for (const p of P) live(F, p, dt, night);
  F.people = P.filter(p => !(p.gone && p.st === 'inside'));
  // two walkers meeting face to face may stop for a word
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.st !== 'walk' || b.st !== 'walk' || t < a.cool || t < b.cool) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.24 || d > 0.42) continue;
    const fa = Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz, fb = -(Math.sin(b.yaw) * dx + Math.cos(b.yaw) * dz);
    if (fa < 0.6 * d || fb < 0.6 * d) continue;
    if (hash(Math.min(a.id, b.id), Math.max(a.id, b.id), Math.floor(t / 30), 143) > 0.5 * (1 - 0.6 * night)) continue;
    const until = t + 3 + 4 * hash(a.id, b.id, Math.floor(t), 143);
    for (const [p, q] of [[a, b], [b, a]]) Object.assign(p, { st: 'chat', mate: q.id, until, t0: t, face: Math.atan2(q.x - p.x, q.z - p.z) });
  }
}

function live(F, p, dt, night) {
  const t = F.t, W = F.world, task = p.task;
  p.lantern = night > 0.45;
  p.gesture *= Math.max(0, 1 - dt * 4);
  // a door left open behind someone swings shut
  if (p.st !== 'enter' && p.st !== 'emerge') { p.door = Math.max(0, p.door - dt / SWING); p.dim = 0; }
  let lookAt = null;
  switch (p.st) {
    case 'inside': {
      p.vis = 0;
      if (t < p.until || p.gone) return;
      // at night most people stay in; the ones who come out carry a lantern
      if (night > 0.3 && rnd(p, 150) < 0.7 * night) { p.until = t + 15 + 40 * rnd(p, 150); return; }
      const D = W.byKey.get(p.at);
      if (!D) { p.until = t + 5; return; }
      // out through the door they went in by: from just inside, onto the street clear of the doorstep
      Object.assign(p, { st: 'emerge', t0: t, way: [0, INDOORS, D.door.step[0] + 0.06], yaw: yawOf(D.dir) + Math.PI, sit: 0, bend: 0 });
      break;
    }
    case 'emerge': case 'enter': {
      // the door swings in, they step through once it is open, and it shuts behind them once they are past it
      const D = W.byKey.get(p.at), T = t - p.t0, [s0, d0, d1] = p.way;
      const speed = p.pace * 0.8, dur = Math.abs(d1 - d0) / speed, u = Math.max(0, Math.min(1, (T - SWING) / dur));
      const d = d0 + (d1 - d0) * u, s = s0 * (1 - smooth(u));
      p.x = D.x + D.dir[1] * s - D.dir[0] * (d - D.door.at); p.z = D.z - D.dir[0] * s - D.dir[1] * (d - D.door.at);
      p.yaw = turn(p.yaw, yawOf(D.dir) + (p.st === 'enter' ? 0 : Math.PI), dt * 8);
      p.v = u > 0 && u < 1 ? speed : 0;
      p.phase += p.v * dt / (0.3 * p.size) * Math.PI * 2;
      p.door = Math.min(1, T / SWING, 1 - (T - SWING - dur) / SWING);
      // into the doorway's shade as they step toward it, all dark by the time they reach it, and out of sight
      // once most of them is past it (whatever still sticks out is as dark as the doorway)
      const front = D.door.front, lit = p.st === 'enter' ? Math.max(d0, front + 0.02) : front + 0.08;
      p.dim = Math.max(0, Math.min(1, (lit - d) / (lit - front)));
      p.vis = d > front - 0.04 ? 1 : 0;
      if (p.st === 'emerge' && u >= 1) { p.st = 'look'; p.until = t; p.t0 = t; }
      if (p.st === 'enter' && u >= 1 && p.door <= 0) { p.st = 'inside'; p.vis = 0; p.door = 0; p.carry = null; p.task = null; p.until = t + stayInside(p, night); return; }
      break;
    }
    case 'look': case 'do': {
      // standing: at a spot doing the errand's thing, or looking about
      const sp = task && task.spot;
      if (sp && p.st === 'do') p.yaw = turn(p.yaw, yawOf(sp.dir), dt * 5);
      const pose = p.st === 'do' && task ? task.pose : 'look';
      p.sit += ((pose === 'sit' ? 1 : 0) - p.sit) * Math.min(1, dt * 6);
      p.bend += ((pose === 'tend' ? 1 : pose === 'browse' ? 0.35 : 0) - p.bend) * Math.min(1, dt * 4);
      if (pose === 'knock' && (t - p.t0) % 0.9 < 0.35) p.gesture = 1;
      if (pose === 'sit' && sp) p.y = sp.y;
      if (t < p.until) break;
      if (p.st === 'do') { finish(F, p); return; }
      const next = nextTask(F, p, night);
      if (next) go(F, p, next); else p.until = t + 2;
      return;
    }
    case 'walk': {
      const P = p.path, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      // keep right of anyone coming the other way, slow behind a slower walker
      let near = null, nd = 0.34;
      for (const q of F.people) {
        if (q === p || q.vis < 0.5) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d < nd && dx * fx + dz * fz > 0.3 * d) { near = q; nd = d; }
      }
      let want = p.pace * (1 - 0.15 * night);
      if (near) {
        const same = near.st === 'walk' && Math.cos(near.yaw - p.yaw) > 0.5;
        want *= same ? Math.max(0.3, Math.min(1, (nd - 0.16) / 0.18)) : nd < 0.2 ? 0.4 : 0.85;
        lookAt = near;
      }
      p.side += ((near && near.st !== 'walk' || near && Math.cos(near.yaw - p.yaw) < 0 ? 0.08 : 0) - p.side) * Math.min(1, dt * 3);
      p.v += (want - p.v) * Math.min(1, dt * 3);
      p.s = Math.min(P.len, p.s + p.v * dt);
      const [x, z, tx, tz] = along(P, p.s), end = Math.min(1, (P.len - p.s) / 0.15);
      p.x = x - tz * p.side * end; p.z = z + tx * p.side * end;
      p.yaw = turn(p.yaw, Math.atan2(tx, tz), dt * 7);
      p.phase += p.v * dt / (0.3 * p.size) * Math.PI * 2;
      p.sit = 0; p.bend += (0 - p.bend) * Math.min(1, dt * 4);
      if (p.s >= P.len - 1e-4) arrive(F, p);
      break;
    }
    case 'settle': case 'rise': {
      // the last step onto a seat, or off it again
      const sp = task.spot, u = Math.min(1, (t - p.t0) / 0.6), e = smooth(u), k = p.st === 'settle' ? e : 1 - e;
      p.x = sp.via[0] + (sp.x - sp.via[0]) * k; p.z = sp.via[1] + (sp.z - sp.via[1]) * k;
      p.y = FLOOR + (sp.y - FLOOR) * Math.max(0, k * 2 - 1);
      p.sit = Math.max(0, k * 2 - 1);
      p.yaw = turn(p.yaw, p.st === 'settle' ? yawOf(sp.dir) : Math.atan2(sp.via[0] - sp.x, sp.via[1] - sp.z), dt * 6);
      if (u < 1) break;
      if (p.st === 'settle') { p.st = 'do'; p.t0 = t; p.until = t + stayOf(p, task); }
      else { sp.taken = -1; p.task = null; p.st = 'look'; p.until = t; }
      break;
    }
    case 'chat': {
      const q = F.people.find(o => o.id === p.mate);
      p.yaw = turn(p.yaw, p.face, dt * 5);
      // they take turns: the one talking gestures, the other nods
      const talking = (Math.floor((t - p.t0) / 1.7) + (p.id < p.mate ? 0 : 1)) % 2 === 0;
      if (talking && (t - p.t0) % 1.7 < 0.6) p.gesture = Math.max(p.gesture, 0.8);
      p.nod = talking ? 0 : Math.max(0, Math.sin((t - p.t0) * 5)) * 0.15;
      lookAt = q;
      if (t < p.until && q && q.st === 'chat') break;
      p.nod = 0; p.cool = t + 25; p.st = 'walk'; p.mate = -1;
      break;
    }
    case 'hop': {
      const u = Math.min(1, (t - p.t0) / 0.5);
      p.x = p.from[0] + (p.to[0] - p.from[0]) * u; p.z = p.from[1] + (p.to[1] - p.from[1]) * u;
      p.hop = 4 * 0.22 * u * (1 - u);
      p.yaw = turn(p.yaw, Math.atan2(p.to[0] - p.from[0], p.to[1] - p.from[1]), dt * 10);
      if (u >= 1) { p.hop = 0; p.st = 'look'; p.until = t + 0.6; p.t0 = t; }
      break;
    }
    case 'vanish': {
      const u = Math.min(1, (t - p.t0) / 0.3);
      p.vis = 1 - smooth(u);
      if (u >= 1) { p.st = 'inside'; p.vis = 0; p.carry = null; p.until = t + stayInside(p, night); }
      return;
    }
  }
  if (p.st !== 'settle' && p.st !== 'rise' && !(p.st === 'do' && task && task.pose === 'sit')) p.y = FLOOR + stepUp(W, p);
  const striding = p.st === 'walk' || p.st === 'enter' || p.st === 'emerge';
  p.gait += ((striding ? Math.min(1, p.v / (0.5 * p.pace)) : 0) - p.gait) * Math.min(1, dt * 8);
  // the head turns toward whoever is near (a passer-by, the person they're talking to), or wanders
  if (!lookAt) for (const q of F.people) if (q !== p && q.vis > 0.5 && dist(p.x, p.z, q.x, q.z) < 0.7) { lookAt = q; break; }
  let aim = 0;
  if (lookAt) aim = Math.max(-1, Math.min(1, wrap(Math.atan2(lookAt.x - p.x, lookAt.z - p.z) - p.yaw)));
  else if (p.st === 'look' || p.st === 'do' && task && (task.pose === 'gaze' || task.pose === 'sit')) aim = Math.sin(t * 0.5 + p.id) * 0.6;
  p.head += (aim - p.head) * Math.min(1, dt * 4);
}
// a door's doorstep under whoever is about to go in or has just come out: a short rise onto the stone, and
// the same height indoors
function stepUp(W, p) {
  const D = p.task && p.task.spot && p.task.spot.door ? p.task.spot : W.byKey.get(p.at);
  if (!D || !D.door || dist(p.x, p.z, D.x, D.z) > 0.4) return 0;
  const [s, d] = across(D, p.x, p.z), [deep, rise, half] = D.door.step;
  return Math.abs(s) > half + 0.02 ? 0 : rise * Math.max(0, Math.min(1, (deep + 0.03 - d) / 0.06));
}
// where (x, z) is from a door: along the wall from its middle, and out from the wall face
function across(D, x, z) {
  const dx = x - D.x, dz = z - D.z;
  return [dx * D.dir[1] - dz * D.dir[0], D.door.at - dx * D.dir[0] - dz * D.dir[1]];
}
const stayOf = (p, task) => task.stay[0] + (task.stay[1] - task.stay[0]) * rnd(p, 151);
const stayInside = (p, night) => (night > 0.5 ? 25 + 50 * rnd(p, 152) : 6 + 16 * rnd(p, 152));

function arrive(F, p) {
  const task = p.task, sp = task.spot;
  p.v = 0;
  note(F, p, task.kind);
  if (sp && sp.via) { p.st = 'settle'; p.t0 = F.t; return; }
  p.st = 'do'; p.t0 = F.t; p.until = F.t + stayOf(p, task);
}
// what people did, recently: for the dev console and the tests
function note(F, p, kind) { F.log.push({ t: F.t, id: p.id, kind }); if (F.log.length > 400) F.log.splice(0, 100); }
function finish(F, p) {
  const task = p.task, sp = task.spot;
  if (task.kind === 'home' || task.kind === 'visit') { p.at = sp.key; p.st = 'enter'; p.t0 = F.t; p.way = [...across(sp, p.x, p.z), INDOORS]; sp.taken = -1; return; }
  if (task.kind === 'shop') p.carry = SHOP_GOODS[sp.sells] || 'basket';
  if (task.kind === 'mooring' && p.persona === 'fisher') p.carry = 'basket';
  if (sp && sp.via) { p.st = 'rise'; p.t0 = F.t; note(F, p, 'rise'); return; }
  if (sp) sp.taken = -1;
  p.task = null; p.st = 'look'; p.until = F.t + 0.3; p.t0 = F.t;
}
