import { describe, expect, it } from 'vitest';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';
import { vAdj } from '../src/core/grid.js';
import { blocks, keyOf } from '../src/core/model.js';
import { emitTown } from '../src/geom/town.js';
import { BODY, makeFolk, stepFolk, syncFolk, tileOf } from '../src/plan/folk.js';

// The townsfolk, run in Node: the same town gives the same people doing the same things; they walk on
// open ground clear of walls and of what details stand on the ground; the town's details give them
// their errands; building under someone moves them aside; night empties the streets.
const towns = { townA: SCENES.townA, townB: SCENES.townB, houseTypes: SCENES.houseTypes };
for (const seed of [1, 2, 3]) towns['sample ' + seed] = D => D.sample(seed);

function live(scene, seconds, night = 0, every = 0, look = () => {}) {
  const { town } = runScene(scene), F = makeFolk();
  syncFolk(F, town.walk);
  for (let i = 0; i < seconds * 30; i++) { stepFolk(F, 1 / 30, night); if (every && i % every === 0) look(F); }
  return F;
}
const segDist = (c, x, z) => {
  const dx = c[2] - c[0], dz = c[3] - c[1], L = dx * dx + dz * dz;
  const u = L > 1e-9 ? Math.max(0, Math.min(1, ((x - c[0]) * dx + (z - c[1]) * dz) / L)) : 0;
  return Math.hypot(x - c[0] - dx * u, z - c[1] - dz * u);
};

describe.each(Object.entries(towns))('%s', (name, scene) => {
  it('is deterministic', () => {
    const snap = F => F.people.map(p => [p.id, p.st, +p.x.toFixed(4), +p.z.toFixed(4)]);
    expect(snap(live(scene, 20))).toEqual(snap(live(scene, 20)));
  });
  it('houses people only where there is a door, one or two to a house', () => {
    const F = live(scene, 0);
    const ids = F.people.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(F.people.length).toBeLessThanOrEqual(40);
    for (const p of F.people) expect(F.world.byKey.get(p.home).kind).toBe('door');
  });
  it('offers spots on the open ground of the tile they are reached from', () => {
    const F = live(scene, 0);
    for (const s of F.world.spots) {
      const t = tileOf(s.x, s.z);
      expect(t === s.v || vAdj[s.v].includes(t) && F.world.open.has(t), `${s.kind} at ${s.x.toFixed(2)}, ${s.z.toFixed(2)}`).toBe(true);
    }
  });
  it('walks on open ground, clear of walls, quay edges and props', () => {
    let checked = 0;
    const bad = [];
    live(scene, 60, 0, 7, F => {
      const W = F.world;
      for (const p of F.people) {
        // the first and last steps of a walk lead out of a doorway or onto a seat, close to things on purpose
        if (p.st !== 'walk' || p.s < 0.3 || p.s > p.path.len - 0.3) continue;
        checked++;
        const t = tileOf(p.x, p.z);
        if (!W.open.has(t)) { bad.push(`${p.id} off the street at tile ${t}`); continue; }
        for (const w of W.walls.get(t)) if (segDist(w, p.x, p.z) < 0.06) bad.push(`${p.id} ${segDist(w, p.x, p.z).toFixed(3)} from a wall`);
        for (const b of W.blocks) if (segDist(b, p.x, p.z) < b[4] + BODY * 0.5) bad.push(`${p.id} inside an obstacle`);
      }
    });
    expect(checked).toBeGreaterThan(100);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

it('goes about every errand the default town offers', () => {
  const F = live(SCENES.townA, 150), done = new Set(F.log.map(e => e.kind));
  for (const kind of ['shop', 'bench', 'quay', 'mooring', 'visit', 'stroll', 'home']) expect(done.has(kind), kind).toBe(true);
  expect(F.log.some(e => e.kind === 'rise')).toBe(true);
});
it('stops for a chat now and then, and passers-by keep apart', () => {
  let chats = 0, close = 0, pairs = 0;
  live(SCENES.townA, 120, 0, 5, F => {
    const P = F.people.filter(p => p.vis > 0.5 && p.st === 'walk');
    chats += F.people.filter(p => p.st === 'chat').length;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      pairs++;
      if (Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) < BODY) close++;
    }
  });
  expect(chats).toBeGreaterThan(0);
  expect(close / pairs).toBeLessThan(0.002);
});
it('empties the streets at night, and those out carry lanterns', () => {
  const outside = F => F.people.filter(p => p.st !== 'inside').length / F.people.length;
  const day = live(SCENES.townA, 150, 0), night = live(SCENES.townA, 150, 1);
  expect(outside(night)).toBeLessThan(outside(day) * 0.75);
  expect(night.people.filter(p => p.st !== 'inside').every(p => p.lantern)).toBe(true);
});
it('moves someone aside when a block is built where they stand', () => {
  const F = live(SCENES.townA, 30);
  const p = F.people.find(o => o.st === 'walk');
  const v = tileOf(p.x, p.z);
  blocks.set(keyOf(v, 1), { c: '#e8a3a0' });
  syncFolk(F, emitTown().walk);
  expect(p.st).toBe('hop');
  for (let i = 0; i < 30; i++) stepFolk(F, 1 / 30);
  expect(F.world.open.has(tileOf(p.x, p.z))).toBe(true);
});
it('lives a frame of the default town in well under a millisecond', () => {
  const { town } = runScene(SCENES.townA), F = makeFolk();
  syncFolk(F, town.walk);
  for (let i = 0; i < 300; i++) stepFolk(F, 1 / 30);
  const t0 = performance.now();
  for (let i = 0; i < 900; i++) stepFolk(F, 1 / 30);
  expect((performance.now() - t0) / 900).toBeLessThan(0.5 * Number(process.env.PERF_BUDGET_SCALE || 1));
});
