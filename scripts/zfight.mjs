import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';
import { TRACE } from '../src/geom/builder.js';
import { findCoplanar, opaqueTriangles } from '../src/geom/overlap.js';

TRACE.on = process.argv.includes('--trace');

// Lists the coplanar, overlapping faces (z-fighting) in each fixture scene, grouped by height band and
// bucket pair, with a few sample positions: `npm run zfight`.
for (const [name, scene] of Object.entries(SCENES).filter(([n]) => !TRACE.on || n === 'townA')) {
  const { town } = runScene(scene), { tris, labels, looks } = opaqueTriangles(town);
  const t0 = performance.now(), ties = findCoplanar(tris, labels, looks);
  const groups = new Map();
  for (const t of ties) {
    const k = TRACE.on ? t.labels.slice().sort().join('  +  ') : t.labels.join('+') + ' @ y≈' + (t.at[1] < 1.02 ? 'street' : (t.at[1] % 1).toFixed(1));
    (groups.get(k) || groups.set(k, []).get(k)).push(t);
  }
  console.log(`${name}: ${ties.length} visible tied face pairs (${(performance.now() - t0).toFixed(0)} ms)`);
  for (const [k, list] of [...groups].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) console.log('  ', list.length, k, JSON.stringify(list.slice(0, 2).map(t => t.at)));
}
