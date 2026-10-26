// ---------- feature registry ----------
// Every detail the planner can place is one module: its rule (where it may go, what it needs, how
// many a house may have, how far apart, why), an optional check for the validator, and its draw
// function. The planner runs the rules in this order; geometry code looks a planned kind up here and
// calls its draw. Adding a feature is adding a module to this list.
import door from './door.js';
import stairs from './stairs.js';
import shop from './shop.js';
import hoist from './hoist.js';
import balcony from './balcony.js';
import woodpile from './woodpile.js';
import barrels from './barrels.js';
import ivy from './ivy.js';
import tree from './tree.js';
import laundry from './laundry.js';
import bunting from './bunting.js';
import stringLights from './stringLights.js';
import tieArch from './tieArch.js';
import lamp from './lamp.js';
import waterStairs from './waterStairs.js';
import bench from './bench.js';
import boat from './boat.js';

export const FEATURES = [door, stairs, shop, hoist, balcony, woodpile, barrels, ivy, tree, laundry, bunting, stringLights, tieArch, lamp, waterStairs, bench, boat];
export const feature = new Map();
for (const f of FEATURES) for (const k of [f.kind, ...(f.aliases || [])]) feature.set(k, f);
// a slot's rules in registry order: 'side' (wall sides), 'overlay' (the foot of a wall), 'node' (open
// tiles), 'edge' (quay edges) and 'boathouse' (floors over open water)
export const rulesFor = slot => FEATURES.filter(f => f.slot === slot).map(f => ({ kind: f.kind, ...f.rule }));
