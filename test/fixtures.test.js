import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';

// Every fixture scene must produce exactly the recorded geometry. A failure here means a change moved
// geometry: if that was the intent, re-record with `npm run fixtures:update` and say why in the commit.
const baseline = JSON.parse(readFileSync(new URL('../fixtures/baseline.json', import.meta.url), 'utf8'));

describe('fixture scenes', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(`${name} matches the recorded geometry`, () => {
      const { digest } = runScene(scene);
      expect(digest).toEqual(baseline[name]);
    });
  }
  it('builds the same town twice in a row', () => {
    expect(runScene(SCENES.townA).digest).toEqual(runScene(SCENES.townA).digest);
  });
});
