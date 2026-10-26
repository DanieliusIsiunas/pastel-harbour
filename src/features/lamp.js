import { GROUND } from '../core/dims.js';
import { VERTS, vAdj } from '../core/grid.js';
import { has } from '../core/model.js';
import { C } from '../core/palette.js';
import { l2, lin } from '../core/util.js';
import { boxAt } from '../geom/builder.js';
import { water } from '../render/stage.js';

// a lamp post: near the water on a quay, in the middle of a plaza
export default {
  kind: 'lamp', slot: 'node',
  rule: { ctx: k => k === 'plaza' || k === 'quay', spacing: 2.4, p: 1, why: 'lights a plaza or a quay' },
  draw(bld, { v, x, z }) {
    // on a quay the lamp stands near the water's edge; on a plaza, in the middle
    const water = vAdj[v].find(n => !has(n, 0));
    const p = water !== undefined ? l2(VERTS[v], VERTS[water], 0.36) : [x, z], iron = lin('#4a5560');
    boxAt(bld, p[0], p[1], 0.03, GROUND, GROUND + 0.07, iron);
    boxAt(bld, p[0], p[1], 0.012, GROUND + 0.07, GROUND + 0.62, iron);
    boxAt(bld, p[0], p[1], 0.036, GROUND + 0.62, GROUND + 0.71, lin(C.lamp), 'lit');
    boxAt(bld, p[0], p[1], 0.046, GROUND + 0.71, GROUND + 0.735, iron);
  },
};
