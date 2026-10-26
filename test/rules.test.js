import { beforeAll, describe, expect, it } from 'vitest';
import { driver, runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';
import { has } from '../src/core/model.js';
import { lampSpot } from '../src/features/lamp.js';
import { spanOf } from '../src/features/span.js';
import { WALK } from '../src/plan/analysis.js';

// Real-world logic, checked on the fixtures and on a spread of generated towns: what the planner places
// must make sense where it is, and the geometry must be well formed.
const towns = { ...SCENES };
for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) towns['sample ' + seed] = D => D.sample(seed);

// the planner keeps its state in modules (the plan, the walking network), so each town is built right
// before its own checks run
describe.each(Object.entries(towns))('%s', (name, scene) => {
  let town, plan;
  beforeAll(() => { ({ town } = runScene(scene)); plan = town.plan; });
  it('passes the planner validator', () => {
    expect(plan.issues).toEqual([]);
  });
  it('opens every door onto open ground', () => {
    for (const [key, kind] of plan.side) {
      if (kind !== 'door') continue;
      const n = +key.split('>')[1].split(':')[0];
      expect(has(n, 0) && !has(n, 1), `door ${key}`).toBe(true);
    }
  });
  it('keeps trees off walkways and gives every lamp and span a place', () => {
    for (const [v, kind] of plan.node) {
      if (kind === 'tree') expect(WALK.route.has(v) || WALK.front.has(v), `tree on tile ${v}`).toBe(false);
      if (kind === 'lamp') expect(lampSpot(v), `lamp on tile ${v}`).toBeTruthy();
      if (['laundry', 'bunting', 'stringLights', 'tieArch'].includes(kind)) expect(spanOf(v), `${kind} on tile ${v}`).toBeTruthy();
    }
  });
  it('keeps the foot of an entrance wall clear', () => {
    for (const key of plan.over.keys()) expect(plan.side.has(key), `${plan.over.get(key)} at ${key}`).toBe(false);
  });
  it('emits finite geometry inside the harbour', () => {
    for (const m of [...town.chunks.values(), ...town.courtyards.values()]) {
      for (const name2 in m) {
        const B = m[name2];
        for (let i = 0; i < B.p.length; i += 3) {
          const x = B.p[i], y = B.p[i + 1], z = B.p[i + 2];
          if (!(Math.abs(x) < 40 && Math.abs(z) < 40 && y > -3 && y < 25)) throw new Error(`${name2} vertex out of bounds: ${x}, ${y}, ${z}`);
        }
        for (const c of B.c) if (!(c >= 0 && c < 8)) throw new Error(`${name2} colour out of range: ${c}`);
      }
    }
  });
});

it('the driver builds what it is given', () => {
  driver.clear();
  driver.build([[driver.vertexAt(0, 0), 0]]);
  expect(has(driver.vertexAt(0, 0), 0)).toBe(true);
});
