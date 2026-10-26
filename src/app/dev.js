import { commit } from './history.js';
import { sampleTown } from './sample.js';
import { VERTS, vAdj, vertexAt } from '../core/grid.js';
import { blocks, keyOf, setBlocks } from '../core/model.js';
import { houses } from '../plan/houses.js';
import { PLAN } from '../plan/planner.js';
import { BRICK_GEO, MATS, brickMat, maskMat, roomDarkMat, roomLitMat } from '../render/materials.js';
import { bloom, gtao } from '../render/post.js';
import { camera, controls, renderer, water } from '../render/stage.js';
import { pickMesh, ripple, townObj } from '../render/town.js';

window.harbourView = (x, y, z, tx = 0, ty = 1, tz = 0) => { camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update(); camera.updateMatrixWorld(); };
window.harbourAO = on => { if (gtao) gtao.enabled = on; };
// dev helper for building precise test scenes from the console
window.harbourDev = {
  vertexAt: (x, z) => vertexAt(x, z, 2), neighbors: v => vAdj[v].slice(), pos: v => VERTS[v],
  build: list => commit(() => { for (const [v, y, c] of list) blocks.set(keyOf(v, y), { c: c || '#e8a3a0' }); }),
  clear: () => commit(() => blocks.clear()),
  bricks: on => { brickMat.visible = on; },
  rooms: on => { maskMat.visible = roomLitMat.visible = roomDarkMat.visible = on; },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  // fixtures: a seeded sample town, and an order-independent fingerprint of everything the town draws
  sample: seed => commit(() => { setBlocks(sampleTown(seed)); }),
  digest: () => {
    const q = x => Math.round(x * 1000);
    const mix = (h, x) => (Math.imul(h ^ x, 2654435761) >>> 0);
    const out = {};
    const add = (key, h) => { const o = out[key] || (out[key] = { n: 0, sum: 0 }); o.n++; o.sum = (o.sum + h) >>> 0; };
    townObj.traverse(o => {
      if (o.isInstancedMesh) {
        const m = o.instanceMatrix.array, c = o.instanceColor ? o.instanceColor.array : null, key = o.geometry === BRICK_GEO ? 'bricks' : 'trees';
        for (let i = 0; i < o.count; i++) {
          let h = 17;
          for (let k = 0; k < 16; k++) h = mix(h, q(m[i * 16 + k]));
          if (c) for (let k = 0; k < 3; k++) h = mix(h, q(c[i * 3 + k]));
          add(key, h);
        }
      } else if (o.isMesh) {
        const key = Object.keys(MATS).find(k => MATS[k] === o.material) || 'other';
        const p = o.geometry.attributes.position.array, c = o.geometry.attributes.color.array, kd = o.geometry.attributes.kind.array;
        for (let t = 0; t < p.length / 9; t++) {
          let h = 31;
          for (let k = 0; k < 9; k++) h = mix(h, q(p[t * 9 + k]) + q(c[t * 9 + k]) * 7);
          for (let k = 0; k < 3; k++) h = mix(h, kd[t * 3 + k]);
          add(key, h);
        }
      }
    });
    if (pickMesh) { const p = pickMesh.geometry.attributes.position.array; for (let t = 0; t < p.length / 9; t++) { let h = 7; for (let k = 0; k < 9; k++) h = mix(h, q(p[t * 9 + k])); add('pick', h); } }
    for (const e of PLAN.log) { let h = 3; for (const ch of e.kind + '|' + e.at) h = mix(h, ch.charCodeAt(0)); add('plan', h); }
    return out;
  },
  // what the planner placed, why, and anything the validator found illogical
  plan: () => {
    const counts = {};
    for (const e of PLAN.log) counts[e.kind] = (counts[e.kind] || 0) + 1;
    const types = {};
    for (const h of houses) types[h.type] = (types[h.type] || 0) + 1;
    return { counts, houseTypes: types, issues: PLAN.issues.slice(0, 20), sample: PLAN.log.slice(0, 8) };
  },
  why: v => PLAN.log.filter(e => e.at.startsWith(v + '>') || e.at === 'tile ' + v || e.at.startsWith('edge ' + v + '~')),
  toggle: { shadows: on => { renderer.shadowMap.autoUpdate = on; }, bloom: on => { bloom.enabled = on; }, reflection: on => { water.visible = on; } },
  count: () => { let tris = 0, inst = 0; townObj.traverse(o => { if (o.isInstancedMesh) inst += o.count; else if (o.isMesh) tris += o.geometry.attributes.position.count / 3; }); return { tris: Math.round(tris), bricks: inst, brickTris: BRICK_GEO.attributes.position.count / 3 }; },
};
window.harbourStats = () => ({ blocks: blocks.size, houses: houses.length, rippling: ripple.length, doors: houses.reduce((n, h) => n + h.doors.size, 0) });
