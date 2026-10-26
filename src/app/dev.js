import { commit } from './history.js';
import { sampleTown } from './sample.js';
import { VERTS, vAdj, vertexAt } from '../core/grid.js';
import { blocks, keyOf, setBlocks } from '../core/model.js';
import { houses } from '../plan/houses.js';
import { lampSpot } from '../features/lamp.js';
import { WALK } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';
import { BRICK_GEO, MATS, brickMat, maskMat, roomDarkMat, roomLitMat } from '../render/materials.js';
import { bloom, gtao, renderFrame } from '../render/post.js';
import { TIMES, applyTime, cur, toState } from '../render/time.js';
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
  // jump straight to a time of day (Day, Dusk, Night) without the transition
  time: name => { Object.assign(cur, toState(TIMES[name])); applyTime(); },
  // How dark and harsh the picture is, read back from the rendered frame at fixed camera views (the
  // middle 70% of the screen, where the town is): mean and 5th-percentile luminance, the share of
  // near-black pixels, the share of "dark sharp" pixels (under half the brightness of their
  // surroundings), and mean saturation. Run on a scene, e.g. sample(20261025), at each time of day.
  shading: (views = [[9, 9, 11, 0, 0.8, 0], [4, 3.2, 5, 0, 1.2, 0], [0.5, 16, 6, 0.5, 0.8, 0]]) => {
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const x0 = Math.floor(w * 0.15), y0 = Math.floor(h * 0.15), W = Math.floor(w * 0.7), H = Math.floor(h * 0.7);
    const out = [], px = new Uint8Array(W * H * 4), L = new Float32Array(W * H);
    for (const v of views) {
      window.harbourView(...v);
      renderer.shadowMap.needsUpdate = true;
      renderFrame(cur.sunI);
      gl.readPixels(x0, y0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, dark = 0, sat = 0;
      for (let i = 0; i < W * H; i++) {
        const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        L[i] = l; sum += l; if (l < 0.12) dark++;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx > 0 ? (mx - mn) / mx : 0;
      }
      // local mean over a 9x9 window from an integral image
      const I = new Float64Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
      let sharp = 0, n = 0; const R = 4;
      for (let y = R; y < H - R; y += 2) for (let x = R; x < W - R; x += 2) {
        const a = (y - R) * (W + 1) + (x - R), b = (y + R + 1) * (W + 1) + (x - R), c = (y - R) * (W + 1) + (x + R + 1), d = (y + R + 1) * (W + 1) + (x + R + 1);
        const m = (I[d] - I[b] - I[c] + I[a]) / ((2 * R + 1) ** 2);
        n++; if (L[y * W + x] < 0.5 * m) sharp++;
      }
      const sorted = Float32Array.from(L).sort();
      out.push({ mean: +(sum / (W * H)).toFixed(3), p05: +sorted[Math.floor(0.05 * sorted.length)].toFixed(3),
        nearBlack: +(100 * dark / (W * H)).toFixed(2), darkSharp: +(100 * sharp / n).toFixed(2), sat: +(sat / (W * H)).toFixed(3) });
    }
    return out;
  },
  // the walking network and where each lamp stands (kerb, wall bracket or the middle of a square)
  walk: () => {
    const lamps = {}, spots = [];
    for (const [v, k] of PLAN.node) if (k === 'lamp') { const s = lampSpot(v), at = s ? s.at : 'none'; lamps[at] = (lamps[at] || 0) + 1; spots.push([v, at, s && s.n]); }
    return { routeTiles: WALK.route.size, frontTiles: WALK.front.size, lamps, spots };
  },
  why: v => PLAN.log.filter(e => e.at.startsWith(v + '>') || e.at === 'tile ' + v || e.at.startsWith('edge ' + v + '~')),
  toggle: { shadows: on => { renderer.shadowMap.autoUpdate = on; }, bloom: on => { bloom.enabled = on; }, reflection: on => { water.visible = on; } },
  count: () => { let tris = 0, inst = 0; townObj.traverse(o => { if (o.isInstancedMesh) inst += o.count; else if (o.isMesh) tris += o.geometry.attributes.position.count / 3; }); return { tris: Math.round(tris), bricks: inst, brickTris: BRICK_GEO.attributes.position.count / 3 }; },
};
window.harbourStats = () => ({ blocks: blocks.size, houses: houses.length, rippling: ripple.length, doors: houses.reduce((n, h) => n + h.doors.size, 0) });
