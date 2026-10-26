import * as THREE from 'three';
import { WATER } from '../core/dims.js';
import { reduceMotion } from '../core/env.js';
import { VERTS, cells, vCells } from '../core/grid.js';
import { blocks, parseKey } from '../core/model.js';
import { C } from '../core/palette.js';
import { hash } from '../core/util.js';
import { burst, sparkleAt } from '../fx/particles.js';
import { pluck } from '../fx/sound.js';
import { BRICK_STRIDE, makeBuilder, newMesh } from '../geom/builder.js';
import { emitCellLevel } from '../geom/buildings.js';
import { emitCourtyard, isCourtyard } from '../geom/ground.js';
import { resetCaches } from '../geom/rules.js';
import { computeHouses } from '../plan/houses.js';
import { planScene } from '../plan/planner.js';
import { frameTown } from './director.js';
import { BRICK_GEO, MATS, WINFX, brickMat, mainMat, treeGeo, treeMat } from './materials.js';
import { markShadows, scene } from './stage.js';
import { updateVoxels } from './voxels.js';

export function meshesFrom(m, pivot) {
  const g = new THREE.Group();
  const bi = m.bricks.inst, nb = bi.length / BRICK_STRIDE;
  if (nb) {
    const im = new THREE.InstancedMesh(BRICK_GEO, brickMat, nb);
    const mt = new THREE.Matrix4(), col = new THREE.Color(), px = pivot ? pivot[0] : 0, py = pivot ? pivot[1] : 0, pz = pivot ? pivot[2] : 0;
    for (let i = 0; i < nb; i++) {
      const o = i * BRICK_STRIDE, w = bi[o + 7], h = bi[o + 8], d = bi[o + 9];
      // columns: along the wall, up, out of the wall
      mt.set(bi[o + 3] * w, 0, bi[o + 5] * d, bi[o] - px,
             0, h, 0, bi[o + 1] - py,
             bi[o + 4] * w, 0, bi[o + 6] * d, bi[o + 2] - pz,
             0, 0, 0, 1);
      im.setMatrixAt(i, mt);
      im.setColorAt(i, col.setRGB(bi[o + 10], bi[o + 11], bi[o + 12]));
    }
    // bricks only matter in the main view: they skip the shadow map, the AO normals and the reflection
    im.castShadow = false; im.receiveShadow = true;
    WINFX.add(im);
    g.add(im);
  }
  for (const name of Object.keys(m)) {
    const B = m[name];
    if (!B.p.length || name === 'bricks') continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
    geo.setAttribute('kind', new THREE.Float32BufferAttribute(B.k, 1));
    if (pivot) geo.translate(-pivot[0], -pivot[1], -pivot[2]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, MATS[name]);
    if (name === 'mask' || name === 'roomLit' || name === 'roomDark') {
      mesh.renderOrder = name === 'mask' ? 5 : 6;
      WINFX.add(mesh);
      mesh.addEventListener('removed', () => WINFX.delete(mesh));
    } else if (name !== 'foam') { mesh.castShadow = true; mesh.receiveShadow = true; } else mesh.renderOrder = 2;
    g.add(mesh);
  }
  if (pivot) g.position.set(pivot[0], pivot[1], pivot[2]);
  return g;
}
export function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && o.geometry !== treeGeo && o.geometry !== BRICK_GEO) o.geometry.dispose();
    if (o.isInstancedMesh) o.dispose();
    WINFX.delete(o);
  });
}

export let townObj = new THREE.Group(); scene.add(townObj);
export let pickMesh = null;
export const pickMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });

// ---------- R4: visible regeneration ----------
// Every cell-level chunk keeps a signature of its geometry. After a click, the chunks whose
// signature changed animate in a ripple spreading out from the click, then the town is baked again.
export let prevSigs = new Map(), regen = null, ripple = [];
export function sigOf(m) {
  let s = 0, n = 0;
  for (const k in m) {
    const p = m[k].p, c = m[k].c, q = m[k].inst;
    n += p.length + q.length;
    for (let i = 0; i < p.length; i++) s = (s * 1.0000037 + p[i] * (i % 13 + 1) + c[i] * 7.1) % 1e7;
    for (let i = 0; i < q.length; i++) s = (s * 1.0000041 + q[i] * (i % 11 + 1)) % 1e7;
  }
  return n + ':' + s.toFixed(3);
}
export function appendMesh(dst, src) {
  for (const k in src) {
    const a = dst[k], b = src[k];
    for (let i = 0; i < b.p.length; i++) { a.p.push(b.p[i]); a.c.push(b.c[i]); }
    for (let i = 0; i < b.k.length; i++) a.k.push(b.k[i]);
    for (let i = 0; i < b.inst.length; i++) a.inst.push(b.inst[i]);
  }
}
export function clearRipple() {
  for (const r of ripple) { disposeGroup(r.obj); scene.remove(r.obj); for (const m of r.mats) m.dispose(); }
  ripple = [];
}
// a ripple piece gets its own copy of the town material so it can glow while it settles
export function glowCopy(obj) {
  const mats = [];
  obj.traverse(o => {
    if (o.isMesh && o.material === mainMat) {
      const m = mainMat.clone();
      m.onBeforeCompile = mainMat.onBeforeCompile;
      m.emissive.set('#ffd9a0');
      m.emissiveIntensity = 0;
      o.material = m;
      mats.push(m);
    }
  });
  return mats;
}

export let MB = null;
// the pick triangles' metadata from the last rebuild, read by the click handler
export let pickMeta = [];
export function requestRegen(r) { regen = r; }
export function rebuild() {
  const focus = regen;
  disposeGroup(townObj); scene.remove(townObj);
  clearRipple();
  const regions = new Map();
  const regionOf = (x, z) => {
    const key = Math.floor((x + 20) / 6) * 100 + Math.floor((z + 20) / 6);
    if (!regions.has(key)) regions.set(key, newMesh());
    return regions.get(key);
  };
  MB = newMesh();
  const now = performance.now(), sigs = new Map(), changed = [];
  resetCaches();
  computeHouses();
  planScene();
  updateVoxels();
  const pick = { P: [], meta: [] };
  const trees = [], todo = new Set();
  for (const k of blocks.keys()) {
    const [v, y] = parseKey(k);
    for (const [ci] of vCells[v]) todo.add(ci * 64 + y);
  }
  for (const code of todo) {
    const m = newMesh();
    emitCellLevel(makeBuilder(m, pick), Math.floor(code / 64), code % 64);
    const sig = sigOf(m);
    sigs.set(code, sig);
    if (regen && prevSigs.size && prevSigs.get(code) !== sig) changed.push({ ci: Math.floor(code / 64), y: code % 64, m });
    else { const c = cells[Math.floor(code / 64)].c; appendMesh(regionOf(c[0], c[1]), m); }
  }
  prevSigs = sigs;
  for (let v = 0; v < VERTS.length; v++) if (isCourtyard(v)) emitCourtyard(makeBuilder(regionOf(VERTS[v][0], VERTS[v][1]), pick), v, trees);
  townObj = new THREE.Group();
  for (const m of regions.values()) townObj.add(meshesFrom(m));
  markShadows();
  if (trees.length) {
    const im = new THREE.InstancedMesh(treeGeo, treeMat, trees.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    trees.forEach(([x, y, z, s], i) => {
      im.setMatrixAt(i, m4.makeScale(s, s * 1.1, s).setPosition(x, y, z));
      im.setColorAt(i, col.set(C.leaf).offsetHSL(0, 0, (hash(i, 3, 3, 3) - 0.5) * 0.08));
    });
    im.castShadow = im.receiveShadow = true;
    townObj.add(im);
  }
  scene.add(townObj);
  if (regen) {
    const [rx, rz] = VERTS[regen.v];
    const echoes = [];
    for (const ch of changed) {
      const [cx, cz] = cells[ch.ci].c, base = ch.y === 0 ? WATER : ch.y;
      const obj = meshesFrom(ch.m, [cx, base, cz]);
      const full = !regen.erase && ch.y === regen.y && cells[ch.ci].v.includes(regen.v);
      // the reshape travels outward from the click like a wave
      const dist = Math.hypot(cx - rx, cz - rz) + Math.abs(ch.y - regen.y) * 0.6;
      const delay = reduceMotion || full ? 0 : Math.min(520, 70 + dist * 120);
      const mats = reduceMotion ? [] : glowCopy(obj);
      obj.scale.set(1, full && !reduceMotion ? 0.001 : 1, 1);
      scene.add(obj);
      ripple.push({ obj, mats, start: now + delay, full, s: full ? 0.02 : 1, v: 0, kicked: false, base, x: cx, z: cz, y: ch.y });
      if (!full) echoes.push(delay);
    }
    const regen0 = regen;
    // a soft rising cascade of notes follows the wave
    echoes.sort((a, b) => a - b).filter((d, i, arr) => i === 0 || d - arr[i - 1] > 45).slice(0, 4)
      .forEach((d, i) => setTimeout(() => pluck(regen0.y + 2 + i * 2, false, 0.32), d));
    burst(regen0);
    regen = null;
  }
  if (pickMesh) { pickMesh.geometry.dispose(); scene.remove(pickMesh); pickMesh = null; }
  pickMeta = pick.meta;
  if (pick.P.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pick.P, 3));
    pickMesh = new THREE.Mesh(g, pickMat);
    pickMesh.visible = false;   // raycasts still hit it; the renderer and the AO pass skip it
    scene.add(pickMesh);
  }
  document.getElementById('count').textContent = blocks.size + (blocks.size === 1 ? ' block' : ' blocks');
  frameTown(focus);
}

// per-frame spring animation of the pieces a click changed; bakes the town when they settle
export function animateRipple(now, dt) {
  if (!ripple.length) return;
  let done = true;
  for (const r of ripple) {
    if (reduceMotion) continue;
    if (now < r.start) { done = false; continue; }
    const age = (now - r.start) / 1000;
    if (!r.kicked) {
      r.kicked = true;
      if (!r.full) { r.v = -2.6; sparkleAt(r.x, r.y + 1.05, r.z, 2); }
    }
    // damped spring toward full height: new pieces overshoot and settle, reshaped ones dip and rebound
    const k = r.full ? 190 : 280, c = r.full ? 12 : 16;
    for (let sub = 0; sub < 3; sub++) {
      const h = dt / 3, acc = -k * (r.s - 1) - c * r.v;
      r.v += acc * h; r.s += r.v * h;
    }
    const sy = Math.max(0.001, r.s);
    const sxz = r.full ? Math.min(1 / Math.sqrt(Math.max(sy, 0.3)), 0.22 + sy) : Math.min(1.2, Math.max(0.85, 1 / Math.sqrt(sy)));
    r.obj.scale.set(sxz, sy, sxz);
    r.obj.position.y = r.base + (r.full ? 0 : 0.06 * Math.sin(Math.min(1, age / 0.32) * Math.PI));
    const glow = (r.full ? 0.5 : 0.2) * Math.exp(-age * 5);
    for (const m of r.mats) m.emissiveIntensity = glow;
    if (age < 0.25 || Math.abs(r.s - 1) > 0.002 || Math.abs(r.v) > 0.02 || glow > 0.01) done = false;
  }
  if (done) rebuild();
}
