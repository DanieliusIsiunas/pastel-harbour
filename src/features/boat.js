import { VERTS, vAdj } from '../core/grid.js';
import { hash, norm2, sub2 } from '../core/util.js';
import { rowboat } from '../geom/ground.js';

// a boathouse: a rowboat moored under a street-level floor that stands over open water
export default {
  kind: 'boat', slot: 'boathouse',
  rule: { p: 0.75, why: 'a boathouse under an arch over the water' },
  draw(bld, { v, x, z }) {
    const nb = vAdj[v][Math.floor(hash(v, 1, 47, 2) * vAdj[v].length)], t = norm2(sub2(VERTS[nb], VERTS[v]));
    rowboat(bld, x, z, t, v);
  },
};
