import { describe, expect, it } from 'vitest';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';

// Budgets for the default 406-block town. Planning and emitting all geometry runs on every click, so it
// must stay fast; triangle and brick counts guard against a feature that quietly multiplies geometry.
// Raise a budget only on purpose, with the reason in the commit.
const BUDGET = { emitMs: 200, mainTris: 380000, bricks: 20000, pickTris: 14000 };

describe('performance budget (townA)', () => {
  it(`plans and emits the town in under ${BUDGET.emitMs} ms`, () => {
    runScene(SCENES.townA);   // warm up
    const times = [];
    for (let i = 0; i < 5; i++) { const t0 = performance.now(); runScene(SCENES.townA); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(BUDGET.emitMs);
  });
  it('stays within the geometry budget', () => {
    const { digest } = runScene(SCENES.townA);
    expect(digest.main.n).toBeLessThan(BUDGET.mainTris);
    expect(digest.bricks.n).toBeLessThan(BUDGET.bricks);
    expect(digest.pick.n).toBeLessThan(BUDGET.pickTris);
  });
});
