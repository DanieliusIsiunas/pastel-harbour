import { beforeEach, describe, expect, it } from 'vitest';
import { driver } from '../fixtures/driver.js';
import { cells, vCells, vFixed } from '../src/core/grid.js';
import { has, setBlocks } from '../src/core/model.js';
import { mulberry32 } from '../src/core/util.js';
import { groundTarget, joinsStreet } from '../src/core/target.js';

// Clicks on the water: a new street joins the streets it reaches along a side, never only at a corner.
const inner = cells.find(c => Math.hypot(c.c[0], c.c[1]) < 4 && c.v.every(v => !vFixed[v]));
const toward = (cell, k, t) => [cell.c[0] + (cell.q[k][0] - cell.c[0]) * t, cell.c[1] + (cell.q[k][1] - cell.c[1]) * t];
const pinched = v => !joinsStreet(v) && vCells[v].some(([ci, k]) => has(cells[ci].v[(k + 2) & 3], 0));

describe('ground build targets', () => {
  beforeEach(() => setBlocks(new Map()));
  it('lays the footprint under the cursor on open water', () => {
    expect(groundTarget(...toward(inner, 2, 0.7))).toEqual({ v: inner.v[2], y: 0 });
  });
  it('bridges a diagonal click with the corner between, then takes the diagonal', () => {
    driver.build([[inner.v[0], 0]]);
    const at = toward(inner, 2, 0.7), first = groundTarget(...at);
    expect([inner.v[1], inner.v[3]]).toContain(first.v);
    driver.build([[first.v, 0]]);
    expect(groundTarget(...at)).toEqual({ v: inner.v[2], y: 0 });
  });
  it('never leaves a new street touching another only at a corner', () => {
    for (const seed of [1, 2, 3]) {
      driver.sample(seed);
      const rnd = mulberry32(seed);
      for (let i = 0; i < 3000; i++) {
        const t = groundTarget((rnd() - 0.5) * 40, (rnd() - 0.5) * 40);
        if (t) expect(pinched(t.v), `seed ${seed}, corner ${t.v}`).toBe(false);
      }
    }
  });
});
