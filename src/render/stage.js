import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WATER } from '../core/dims.js';
import { busy, reduceMotion } from '../core/env.js';
import { GRID, UVM, xz } from '../core/grid.js';
import { WINFX } from './materials.js';

// ---------- scene ----------
export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// the town only changes on clicks, ripples and time of day, so the shadow map is redrawn only then
renderer.shadowMap.autoUpdate = false;
export let shadowsDirty = true;
export function markShadows() { shadowsDirty = true; }
export function consumeShadows() { const d = shadowsDirty; shadowsDirty = false; return d; }
// AgX keeps pastel colours and lifts dark tones gently, where ACES crushed the shadows and pushed oranges
// toward neon
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.12;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#86b1b8', 45, 150);

export const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 800);
camera.position.set(24, 24, 30);
export const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2, 1);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.42;
controls.minDistance = 5;
controls.maxDistance = 85;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

export const hemi = new THREE.HemisphereLight('#fdf6ec', '#7fb2bf', 1.5);
scene.add(hemi);
export const sun = new THREE.DirectionalLight('#fff1db', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

export const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#9fd0e6') }, horizon: { value: new THREE.Color('#e6f2ef') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0); }',
}));
scene.add(sky);

// clear water: a soft, rippled reflection over a sea floor and sandy shelves you can see through it
export const seaFloor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3d7b86', roughness: 1 }));
seaFloor.position.y = WATER - 0.9;
seaFloor.receiveShadow = true;
scene.add(seaFloor);
export const WaterShader = {
  name: 'HarbourWater',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uTime: { value: 0 }, uWater: { value: new THREE.Color('#5d9ca6') }, uAlpha: { value: 0.86 }, uRefl: { value: 0.2 },
    uFog: { value: new THREE.Color('#9fc6ca') }, uFogNear: { value: 45 }, uFogFar: { value: 150 },
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWP;
void main() { vUv = textureMatrix * vec4(position, 1.0); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uWater; uniform vec3 uFog; uniform float uTime; uniform float uAlpha; uniform float uRefl; uniform float uFogNear; uniform float uFogFar;
varying vec4 vUv; varying vec3 vWP;
void main() {
  vec2 d = vec2(sin(vWP.x * 1.6 + uTime * 1.1) + sin(vWP.z * 2.2 - uTime * 0.8), cos(vWP.z * 1.8 + uTime * 0.9) + sin(vWP.x * 1.2 - uTime * 0.7)) * 0.006;
  vec4 uv = vUv; uv.xy += d * uv.w;
  vec3 col = mix(uWater, texture2DProj(tDiffuse, uv).rgb, uRefl);
  float f = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWP));
  gl_FragColor = vec4(mix(col, uFog, f), mix(uAlpha, 1.0, f));
}`,
};
export const water = new Reflector(new THREE.PlaneGeometry(400, 400), { shader: WaterShader, textureWidth: 1024, textureHeight: 1024, clipBias: 0.003 });
water.rotation.x = -Math.PI / 2;
water.position.y = WATER;
water.material.transparent = true;
water.material.depthWrite = false;
water.renderOrder = 1;
// the AO pass renders the scene with an override material; the reflection must not re-render then
export const renderReflection = water.onBeforeRender;
export const lastView = new THREE.Matrix4();
export let reflectFrame = 0;
water.onBeforeRender = function (r, sc, cam) {
  if (sc.overrideMaterial) return;
  const moved = !lastView.equals(cam.matrixWorld);
  lastView.copy(cam.matrixWorld);
  if (!moved && !busy.anim && (reflectFrame++ % 3) !== 0) return;
  for (const m of WINFX) m.visible = false;
  renderReflection.call(this, r, sc, cam);
  for (const m of WINFX) m.visible = true;
};
scene.add(water);

// grid lines that brighten around the cursor
export const gridPos = [];
// the water grid shows build targets, not cells: each line runs from an edge midpoint to a cell centre,
// so every outlined patch is exactly the footprint a click there fills
for (const cell of GRID.cells) {
  UVM.forEach((m, k) => {
    if (cell.nb[k] < 0) return;   // the outer rim's corners can't be built on
    const p = xz(cell, m[0], m[1]);
    gridPos.push(p[0], WATER + 0.16, p[1], cell.c[0], WATER + 0.16, cell.c[1]);
  });
}
export const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPos, 3));
export const gridMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uCursor: { value: new THREE.Vector3(999, 0, 999) }, uBase: { value: 0.07 }, uHi: { value: 0.55 } },
  vertexShader: 'varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uCursor; uniform float uBase; uniform float uHi; varying vec3 vW; void main(){ float d = distance(vW.xz, uCursor.xz); gl_FragColor = vec4(1.0, 1.0, 1.0, uBase + uHi * smoothstep(3.5, 0.0, d)); }',
});
scene.add(new THREE.LineSegments(gridGeo, gridMat));

export function animateWater(t) {
  if (!reduceMotion) water.material.uniforms.uTime.value = t;
}
