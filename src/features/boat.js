import { VERTS, vAdj } from '../core/grid.js';
import { blocks, has, keyOf } from '../core/model.js';
import { hash, norm2, sub2 } from '../core/util.js';
import { launch } from '../geom/boats.js';

// a boathouse: the house above keeps its covered launch under the arch, bow out toward open water
export default {
  kind: 'boat', slot: 'boathouse',
  rule: { p: 0.75, why: 'a boathouse under an arch over the water' },
  draw(bld, { v, x, z }) {
    const out = vAdj[v].filter(n => !has(n, 0) && !has(n, 1)), pool = out.length ? out : vAdj[v];
    const nb = pool[Math.floor(hash(v, 1, 47, 2) * pool.length)], t = norm2(sub2(VERTS[nb], VERTS[v]));
    launch(bld, x, z, t, blocks.get(keyOf(v, 1)).c, v);
  },
};
