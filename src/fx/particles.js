import * as THREE from 'three';
import { GROUND, WATER } from '../core/dims.js';
import { reduceMotion } from '../core/env.js';
import { VERTS } from '../core/grid.js';
import { scene } from '../render/stage.js';

// ---------- effects: dust, sparkles and water rings ----------
export const FX_N = 500;
export const fxPos = new Float32Array(FX_N * 3), fxCol = new Float32Array(FX_N * 3), fxSize = new Float32Array(FX_N), fxAlpha = new Float32Array(FX_N);
export const fxState = Array.from({ length: FX_N }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, kind: 0, size: 0.1, ph: 0 }));
export const fxGeo = new THREE.BufferGeometry();
fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3));
fxGeo.setAttribute('fxColor', new THREE.BufferAttribute(fxCol, 3));
fxGeo.setAttribute('size', new THREE.BufferAttribute(fxSize, 1));
fxGeo.setAttribute('alpha', new THREE.BufferAttribute(fxAlpha, 1));
export const fxMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uScale: { value: 500 } },
  vertexShader: `attribute float size; attribute float alpha; attribute vec3 fxColor; uniform float uScale; varying vec3 vC; varying float vA;
void main() { vC = fxColor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA;
void main() { float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); float core = smoothstep(0.18, 0.0, r); gl_FragColor = vec4(vC + core * 0.35, a * vA); }`,
});
export const fx = new THREE.Points(fxGeo, fxMat);
fx.frustumCulled = false;
fx.renderOrder = 3;
scene.add(fx);
export let fxNext = 0;
export const fxTmp = new THREE.Color();
export function spawn(kind, x, y, z, vx, vy, vz, life, size, hex) {
  fxIdle = false;
  const i = fxNext; fxNext = (fxNext + 1) % FX_N;
  const st = fxState[i];
  Object.assign(st, { life: 0, max: life, vx, vy, vz, kind, size, ph: Math.random() * 6.28 });
  fxPos[i * 3] = x; fxPos[i * 3 + 1] = y; fxPos[i * 3 + 2] = z;
  fxTmp.set(hex);
  fxCol[i * 3] = fxTmp.r; fxCol[i * 3 + 1] = fxTmp.g; fxCol[i * 3 + 2] = fxTmp.b;
}
export function sparkleAt(x, y, z, n) {
  if (reduceMotion) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, r = Math.random() * 0.25;
    spawn(1, x + Math.cos(a) * r, y + Math.random() * 0.2, z + Math.sin(a) * r, Math.cos(a) * 0.15, 0.5 + Math.random() * 0.6, Math.sin(a) * 0.15, 0.7 + Math.random() * 0.5, 0.06 + Math.random() * 0.04, Math.random() < 0.6 ? '#ffd98a' : '#fff6dc');
  }
}
// the burst that greets each click: a dust ring, rising sparkles, and rings on the water for streets
export function burst(rg) {
  if (reduceMotion) return;
  const [x, z] = VERTS[rg.v], y = rg.y === 0 ? GROUND : rg.y;
  const dust = rg.erase ? '#e6ddd0' : '#f6f0e4';
  const n = rg.erase ? 26 : 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + Math.random() * 0.3, sp = 0.6 + Math.random() * 0.6;
    const yy = rg.erase ? y + Math.random() * 0.8 : y + 0.04;
    spawn(0, x + Math.cos(a) * 0.35, yy, z + Math.sin(a) * 0.35, Math.cos(a) * sp, 0.12 + Math.random() * (rg.erase ? 0.5 : 0.15), Math.sin(a) * sp, 0.7 + Math.random() * 0.4, rg.erase ? 0.3 : 0.22, dust);
  }
  if (!rg.erase) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 0.4;
      spawn(1, x + Math.cos(a) * r, y + Math.random() * 0.9, z + Math.sin(a) * r, Math.cos(a) * 0.25, 0.7 + Math.random() * 0.9, Math.sin(a) * 0.25, 0.8 + Math.random() * 0.6, 0.06 + Math.random() * 0.05, Math.random() < 0.65 ? '#ffd98a' : '#fff6dc');
    }
  }
  if (rg.y === 0) { waterRing(x, z, 0); waterRing(x, z, 0.16); }
}
export const rings = [];
export const ringGeo = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
export function waterRing(x, z, delay) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  m.position.set(x, WATER + 0.02, z);
  m.renderOrder = 2;
  scene.add(m);
  rings.push({ m, start: performance.now() + delay * 1000 });
}
export let fxIdle = false;
export function updateFx(dt, t) {
  if (fxIdle && !rings.length) return;
  let alive = 0;
  for (let i = 0; i < FX_N; i++) {
    const st = fxState[i];
    if (st.life >= st.max) { fxAlpha[i] = 0; continue; }
    alive++;
    st.life += dt;
    const p = Math.min(1, st.life / st.max);
    if (st.kind === 0) {
      st.vx *= 0.9; st.vz *= 0.9; st.vy = st.vy * 0.94 + 0.02;
      fxAlpha[i] = 0.5 * Math.pow(1 - p, 1.6);
      fxSize[i] = st.size * (1 + p * 1.8);
    } else {
      st.vx *= 0.97; st.vz *= 0.97; st.vy *= 0.96;
      fxAlpha[i] = (1 - p) * (0.55 + 0.45 * Math.sin(st.life * 26 + st.ph));
      fxSize[i] = st.size * (1 - p * 0.4);
    }
    fxPos[i * 3] += st.vx * dt; fxPos[i * 3 + 1] += st.vy * dt; fxPos[i * 3 + 2] += st.vz * dt;
  }
  fxGeo.attributes.position.needsUpdate = true;
  fxGeo.attributes.size.needsUpdate = true;
  fxGeo.attributes.alpha.needsUpdate = true;
  fxGeo.attributes.fxColor.needsUpdate = true;
  fxIdle = alive === 0;
  const now = performance.now();
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], p = (now - r.start) / 1100;
    if (p < 0) continue;
    if (p >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - p, 3);
    r.m.scale.setScalar(0.45 + e * 1.9);
    r.m.material.opacity = 0.55 * (1 - p);
  }
}
