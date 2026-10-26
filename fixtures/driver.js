import { VERTS, vAdj, vertexAt } from '../src/core/grid.js';
import { blocks, keyOf, setBlocks } from '../src/core/model.js';
import { sampleTown } from '../src/core/sample.js';
import { digestTown, emitTown } from '../src/geom/town.js';

// The fixture scenes' building API without a browser: the same calls `harbourDev` offers in the page,
// acting directly on the block model. Used by the tests and by `npm run fixtures:update`.
export const driver = {
  vertexAt: (x, z) => vertexAt(x, z, 2),
  neighbors: v => vAdj[v].slice(),
  pos: v => VERTS[v],
  build: list => { for (const [v, y, c] of list) blocks.set(keyOf(v, y), { c: c || '#e8a3a0' }); },
  clear: () => blocks.clear(),
  sample: seed => setBlocks(sampleTown(seed)),
};
// run a scene from scratch and return the emitted town with its digest
export function runScene(scene) {
  setBlocks(new Map());
  scene(driver);
  const town = emitTown();
  return { town, digest: digestTown(town) };
}
