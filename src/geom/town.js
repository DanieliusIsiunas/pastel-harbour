import { VERTS, vCells } from '../core/grid.js';
import { blocks, parseKey } from '../core/model.js';
import { computeHouses } from '../plan/houses.js';
import { PLAN, planScene } from '../plan/planner.js';
import { BRICK_STRIDE, makeBuilder, newMesh } from './builder.js';
import { emitCellLevel } from './buildings.js';
import { emitCourtyard, isCourtyard } from './ground.js';
import { resetCaches } from './rules.js';

// ---------- the whole town as plain data ----------
// Plans the scene and emits every piece of geometry, without Three.js: the renderer turns the result into
// meshes, and tests and the fixture digest read it directly. A chunk is one cell at one level, keyed
// cell * 64 + level; courtyards are emitted per open tile.
export function emitTown() {
  resetCaches();
  computeHouses();
  planScene();
  const pick = { P: [], meta: [] }, trees = [], chunks = new Map(), courtyards = new Map(), todo = new Set();
  for (const k of blocks.keys()) {
    const [v, y] = parseKey(k);
    for (const [ci] of vCells[v]) todo.add(ci * 64 + y);
  }
  for (const code of todo) {
    const m = newMesh();
    emitCellLevel(makeBuilder(m, pick), Math.floor(code / 64), code % 64);
    chunks.set(code, m);
  }
  for (let v = 0; v < VERTS.length; v++) {
    if (!isCourtyard(v)) continue;
    const m = newMesh();
    emitCourtyard(makeBuilder(m, pick), v, trees);
    courtyards.set(v, m);
  }
  return { chunks, courtyards, trees, pick, plan: PLAN };
}

// a cheap signature of a chunk's geometry, to tell which chunks a click changed
export function sigOf(m) {
  let s = 0, n = 0;
  for (const k in m) {
    const p = m[k].p, c = m[k].c, q = m[k].inst;
    n += p.length + q.length;
    for (let i = 0; i < p.length; i++) s = (s * 1.0000037 + p[i] * (i % 13 + 1) + c[i] * 7.1) % 1e7;
    for (let i = 0; i < q.length; i++) s = (s * 1.0000041 + q[i] * (i % 11 + 1)) % 1e7;
  }
  return n + ':' + s.toFixed(3);
}
export function appendMesh(dst, src) {
  for (const k in src) {
    const a = dst[k], b = src[k];
    for (let i = 0; i < b.p.length; i++) { a.p.push(b.p[i]); a.c.push(b.c[i]); }
    for (let i = 0; i < b.k.length; i++) a.k.push(b.k[i]);
    for (let i = 0; i < b.inst.length; i++) a.inst.push(b.inst[i]);
  }
}

// The fingerprint fixtures are checked against: for every bucket, the number of triangles (or brick and
// tree instances, pick triangles, plan entries) and an order-independent sum of their hashes, with
// positions and colours rounded to 1/1000. Equal digests mean the same town, triangle for triangle.
export function digestTown(t) {
  const q = x => Math.round(x * 1000), mix = (h, x) => (Math.imul(h ^ x, 2654435761) >>> 0);
  const out = {}, add = (key, h) => { const o = out[key] || (out[key] = { n: 0, sum: 0 }); o.n++; o.sum = (o.sum + h) >>> 0; };
  const meshes = [...t.chunks.values(), ...t.courtyards.values()];
  for (const m of meshes) {
    for (const name in m) {
      const B = m[name];
      if (name === 'bricks') {
        for (let i = 0; i < B.inst.length; i += BRICK_STRIDE) {
          let h = 17;
          for (let k = 0; k < BRICK_STRIDE; k++) h = mix(h, q(B.inst[i + k]));
          add('bricks', h);
        }
        continue;
      }
      for (let tri = 0; tri < B.p.length / 9; tri++) {
        let h = 31;
        for (let k = 0; k < 9; k++) h = mix(h, q(B.p[tri * 9 + k]) + q(B.c[tri * 9 + k]) * 7);
        for (let k = 0; k < 3; k++) h = mix(h, B.k[tri * 3 + k]);
        add(name, h);
      }
    }
  }
  for (const tr of t.trees) { let h = 5; for (const x of tr) h = mix(h, q(x)); add('trees', h); }
  for (let i = 0; i < t.pick.P.length; i += 9) { let h = 7; for (let k = 0; k < 9; k++) h = mix(h, q(t.pick.P[i + k])); add('pick', h); }
  for (const e of t.plan.log) { let h = 3; for (const ch of e.kind + '|' + e.at) h = mix(h, ch.charCodeAt(0)); add('plan', h); }
  return out;
}
