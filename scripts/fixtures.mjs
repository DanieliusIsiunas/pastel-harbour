import { writeFileSync } from 'node:fs';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';

// Re-records fixtures/baseline.json. Run it only after a change that is meant to alter the town's
// geometry, and say in the commit what changed and why.
const out = {};
for (const [name, scene] of Object.entries(SCENES)) out[name] = runScene(scene).digest;
writeFileSync(new URL('../fixtures/baseline.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('fixtures/baseline.json re-recorded:', Object.keys(out).join(', '));
