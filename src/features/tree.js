import { VERTS, vAdj } from '../core/grid.js';
import { has } from '../core/model.js';
import { l2 } from '../core/util.js';
import { obstacle } from '../geom/builder.js';
import { plantedTree } from '../geom/ground.js';
import { WALK, edgeKey, hasInterior, isOpen, onRoute } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';

// A tree in a round planter: in the middle of a square people can walk around, or at the water's edge of
// a wide quay that isn't the only way through. Never on a lane, a pier or in front of a door.
// the water side it leans toward: a free stretch of quay edge, not one with a bench or a water stair
const shore = v => vAdj[v].find(n => !has(n, 0) && !PLAN.edge.has(edgeKey(v, n)));
const roomy = v => !onRoute(v) && !WALK.front.has(v) && vAdj[v].filter(isOpen).length >= 3;
export default {
  kind: 'tree', slot: 'node',
  rule: { ctx: k => k === 'plaza' || k === 'quay', needs: v => roomy(v) && (hasInterior(v) || shore(v) !== undefined),
    spacing: 2.6, p: 0.75, why: 'shade where the street has room to spare' },
  check: v => (roomy(v) ? null : 'tree on a walkway'),
  draw(bld, { v, x, z }) {
    const water = hasInterior(v) ? undefined : shore(v);
    const p = water === undefined ? [x, z] : l2(VERTS[v], VERTS[water], 0.3);
    obstacle(bld, p, p, 0.15);
    plantedTree(bld, p[0], p[1], v);
  },
};
