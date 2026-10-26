import { plantedTree } from '../geom/ground.js';

// a tree in a round planter on an open plaza
export default {
  kind: 'tree', slot: 'node',
  rule: { ctx: k => k === 'plaza', spacing: 2.6, p: 0.75, why: 'shade on an open plaza' },
  draw(bld, { v, x, z }) {
    plantedTree(bld, x, z, v);
  },
};
