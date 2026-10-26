import * as THREE from 'three';
import { commit } from './history.js';
import { sampleTown } from '../core/sample.js';
import { VERTS, vAdj, vertexAt } from '../core/grid.js';
import { blocks, has, keyOf, setBlocks } from '../core/model.js';
import { houses } from '../plan/houses.js';
import { lampSpot } from '../features/lamp.js';
import { rippleClock, ripples } from '../fx/particles.js';
import { spanOf } from '../features/span.js';
import { digestTown, emitTown } from '../geom/town.js';
import { WALK } from '../plan/analysis.js';
import { PLAN } from '../plan/planner.js';
import { BRICK_GEO, brickMat, maskMat, roomDarkMat, roomLitMat } from '../render/materials.js';
import { bloom, gtao, renderFrame } from '../render/post.js';
import { TIMES, applyTime, cur, toState } from '../render/time.js';
import { camera, controls, renderer, scene, water } from '../render/stage.js';
import { requestRegen, ripple, townObj } from '../render/town.js';
import { cameraState, directCamera, setManualCamera, steerCamera } from '../render/director.js';

// close-ups may come nearer than the player's zoom limit; the limit returns on the next wider view
window.harbourView = (x, y, z, tx = 0, ty = 1, tz = 0) => {
  setManualCamera(true);
  camera.position.set(x, y, z); controls.target.set(tx, ty, tz);
  controls.minDistance = Math.min(5, camera.position.distanceTo(controls.target) * 0.95);
  controls.update(); camera.updateMatrixWorld();
};
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
  // the fixture fingerprint of the current town (the same function the tests use)
  digest: () => digestTown(emitTown()),
  // what the planner placed, why, and anything the validator found illogical
  plan: () => {
    const counts = {};
    for (const e of PLAN.log) counts[e.kind] = (counts[e.kind] || 0) + 1;
    const types = {};
    for (const h of houses) types[h.type] = (types[h.type] || 0) + 1;
    return { counts, houseTypes: types, issues: PLAN.issues.slice(0, 20), sample: PLAN.log.slice(0, 8) };
  },
  // where every planned feature of a kind went: 'tile v', 'edge v~n' or 'v>n:y' (a wall side)
  find: kind => PLAN.log.filter(e => e.kind === kind).map(e => e.at),
  // frame the i-th planned feature of a kind on a tile: the camera stands back along the open street,
  // looking at it from about head height above the roofs of a two-storey house
  look: (kind, i = 0, back = 1.9, h = 3.1, ty = 2.2) => {
    const at = PLAN.log.filter(e => e.kind === kind && e.at.startsWith('tile '))[i];
    if (!at) return null;
    const v = +at.at.slice(5), P = VERTS[v], sp = spanOf(v), open = vAdj[v].filter(n => has(n, 0) && !has(n, 1));
    // a span is seen from along its lane; anything else from its first open neighbour
    let d = sp ? sp.nrm : null;
    if (!d) { const Q = VERTS[open.length ? open[0] : vAdj[v][0]], l = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1; d = [(Q[0] - P[0]) / l, (Q[1] - P[1]) / l]; }
    window.harbourView(P[0] + d[0] * back, h, P[1] + d[1] * back, P[0], ty, P[1]);
    return v;
  },
  span: v => spanOf(v),
  // place or remove one block exactly the way a click does, with its animation, splash and sound
  place: (v, y = 0, c = '#e8a3a0') => { requestRegen({ v, y, erase: false }); commit(() => blocks.set(keyOf(v, y), { c })); },
  remove: (v, y = 0) => { requestRegen({ v, y, erase: true }); commit(() => blocks.delete(keyOf(v, y))); },
  // render a ripple from corner v frozen at a given age (seconds), for judging the water without timing luck
  rippleAt: (v, age = 0.6, strength = 1) => {
    if (v == null) { rippleClock.frozen = null; ripples.length = 0; return; }
    rippleClock.frozen = 1000; ripples.length = 0;
    ripples.push({ x: VERTS[v][0], z: VERTS[v][1], t: 1000 - age, s: strength }, { x: VERTS[v][0], z: VERTS[v][1], t: 1000 - age + 0.22, s: strength * 0.55 });
  },
  // hand the camera back to the director after harbourView, and report what it is doing
  auto: () => setManualCamera(false),
  camera: () => cameraState(),
  // how far the camera's viewing direction is off its target at the moment each frame is drawn, sampled for
  // ms milliseconds (degrees): a camera that is moved but not re-aimed shows up here as shaking
  aimProbe: ms => new Promise(done => {
    const errs = [], fwd = new THREE.Vector3(), to = new THREE.Vector3(), prev = scene.onBeforeRender;
    scene.onBeforeRender = (r, s, cam) => {
      if (cam !== camera) return;
      cam.getWorldDirection(fwd); to.copy(controls.target).sub(cam.position).normalize();
      errs.push(Math.acos(Math.min(1, fwd.dot(to))) * 180 / Math.PI);
    };
    setTimeout(() => {
      scene.onBeforeRender = prev;
      done({ frames: errs.length, maxDeg: +Math.max(0, ...errs).toFixed(3), meanDeg: +(errs.reduce((a, b) => a + b, 0) / (errs.length || 1)).toFixed(3) });
    }, ms);
  }),
  // runs the camera's per-frame steps for n frames of a held arrow key, synchronously (no animation frames
  // needed), and reports how far the view direction is off the target when each frame would be drawn
  steerTest: (turn = 1, zoom = 0, n = 60) => {
    const fwd = new THREE.Vector3(), to = new THREE.Vector3(), errs = [];
    for (let i = 0; i <= n + 20; i++) {
      controls.update();
      steerCamera(i < n ? turn : 0, i < n ? zoom : 0, 1 / 60);
      directCamera(1 / 60);
      camera.updateMatrixWorld();
      camera.getWorldDirection(fwd); to.copy(controls.target).sub(camera.position).normalize();
      errs.push(Math.acos(Math.min(1, fwd.dot(to))) * 180 / Math.PI);
    }
    return { frames: errs.length, maxDeg: +Math.max(...errs).toFixed(3), meanDeg: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(3) };
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
