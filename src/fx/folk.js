import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lowPower } from '../core/env.js';
import { GROUND } from '../core/dims.js';
import { smooth } from '../core/util.js';
import { makeFolk, stepFolk, syncFolk } from '../plan/folk.js';
import { WINFX, instancedAO } from '../render/materials.js';
import { scene } from '../render/stage.js';

// ---------- townsfolk: how they look ----------
// Little toy people in the town's own manner: a rounded body, a big round head, stubby limbs that swing as
// they walk, clothes a shade deeper than the walls, hats and hair that say who they are. Each body part is
// one instanced mesh for everyone (about twenty draw calls in all). They take the town's light and
// shadows but cast none (the shadow map is only redrawn on clicks); a soft blob under each one grounds it.
// What they do comes from plan/folk.js; this file only poses them.

export const folk = makeFolk();
// how fast their time runs: 0 freezes everyone in place (for close-ups from the dev console)
export const folkClock = { rate: 1 };
const CAP = lowPower ? 18 : 40;
export function syncTownFolk(walk) { syncFolk(folk, walk, CAP); }

// geometry helpers: every part carries a vertex colour that multiplies its instance colour, so one part can
// have a darker band or sole without a mesh of its own
const tint = (g, k) => {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const f = typeof k === 'function' ? k(g.attributes.position, i) : k; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
};
const merge = (...gs) => mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)));
const lathe = (pts, n = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h).scale(sx, sy, sz).translate(x, y, z);

// proportions of an adult at size 1 (about 0.5 tall: a door is 0.64), feet at the origin, facing +z
const HIP = 0.17, SHOULDER = 0.165, NECK = 0.195, ARM = 0.15;
const GEO = {
  // body from the hips up, pivoting at the hips; a little flatter front to back
  torso: tint(lathe([[0, -0.02], [0.05, -0.018], [0.06, 0], [0.064, 0.07], [0.062, 0.13], [0.054, 0.165], [0.034, 0.185], [0.016, 0.195], [0, 0.2]]).scale(1, 1, 0.82), 1),
  skirt: tint(lathe([[0, -0.1], [0.086, -0.1], [0.08, -0.06], [0.064, 0.02], [0.056, 0.05]]).scale(1, 1, 0.88), (p, i) => (p.getY(i) < -0.09 ? 0.85 : 1)),
  // a leg from the hip down with a darker shoe
  leg: tint(merge(new THREE.CapsuleGeometry(0.024, 0.13, 3, 8).translate(0, -0.08, 0), new THREE.BoxGeometry(0.042, 0.026, 0.066).translate(0, -0.157, 0.014)),
    (p, i) => (p.getY(i) < -0.14 ? 0.38 : 1)),
  arm: tint(new THREE.CapsuleGeometry(0.018, 0.11, 3, 8).translate(0, -0.068, 0), 1),
  hand: tint(ball(0.021, 0, 0, 0, 1, 1, 1, 8, 6), 1),
  // the head from the neck up, with a small nose so you can tell which way someone looks
  head: tint(merge(ball(0.058, 0, 0.05, 0), ball(0.012, 0, 0.045, 0.056, 1, 1, 1, 6, 5)), 1),
  // two dot eyes, just proud of the face
  eyes: tint(merge(ball(0.0075, -0.022, 0.06, 0.052, 1, 1.3, 0.6, 6, 5), ball(0.0075, 0.022, 0.06, 0.052, 1, 1.3, 0.6, 6, 5)), 1),
  hairShort: tint(new THREE.SphereGeometry(0.062, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52).rotateX(-0.42).translate(0, 0.053, -0.004), 1),
  hairBun: tint(merge(new THREE.SphereGeometry(0.062, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52).rotateX(-0.42).translate(0, 0.053, -0.004),
    ball(0.027, 0, 0.098, -0.048)), 1),
  hairLong: tint(merge(new THREE.SphereGeometry(0.062, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52).rotateX(-0.42).translate(0, 0.053, -0.004),
    ball(0.05, 0, 0.012, -0.03, 1.1, 1.3, 0.62)), 1),
  // hats: a straw boater with a dark band, a flat cap with a peak, a beret, a fisher's sou'wester
  straw: tint(merge(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 16).translate(0, 0.088, 0), new THREE.CylinderGeometry(0.056, 0.058, 0.04, 14).translate(0, 0.11, 0)),
    (p, i) => (p.getY(i) > 0.09 && p.getY(i) < 0.103 && Math.hypot(p.getX(i), p.getZ(i)) < 0.06 ? 0.45 : 1)),
  cap: tint(merge(ball(0.064, 0, 0.083, -0.004, 1, 0.5, 1.05, 12, 6), new THREE.BoxGeometry(0.075, 0.008, 0.045).rotateX(0.18).translate(0, 0.082, 0.064)), 1),
  beret: tint(ball(0.068, 0.006, 0.1, -0.008, 1, 0.34, 1, 14, 7).rotateZ(0.18), 1),
  souwester: tint(merge(new THREE.SphereGeometry(0.064, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.06, 0),
    lathe([[0.062, 0.075], [0.105, 0.05], [0.11, 0.044], [0.06, 0.068]], 16).translate(0, 0, -0.012)), 1),
  basket: tint(merge(new THREE.BoxGeometry(0.07, 0.042, 0.05).translate(0, -0.06, 0),
    new THREE.TorusGeometry(0.03, 0.004, 4, 10, Math.PI).translate(0, -0.039, 0)), (p, i) => (p.getY(i) > -0.042 ? 0.8 : 1)),
  bread: tint(new THREE.CapsuleGeometry(0.018, 0.1, 3, 8).rotateX(Math.PI / 2), (p, i) => (Math.abs(p.getZ(i)) > 0.06 ? 0.82 : 1)),
  lantern: tint(merge(new THREE.BoxGeometry(0.036, 0.008, 0.036).translate(0, -0.024, 0), new THREE.BoxGeometry(0.044, 0.008, 0.044).translate(0, -0.08, 0),
    new THREE.CylinderGeometry(0.003, 0.003, 0.03, 4).translate(0, -0.008, 0)), 1),
  flame: tint(new THREE.BoxGeometry(0.03, 0.046, 0.03).translate(0, -0.052, 0), 1),
};
GEO.shadow = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
// the dark of a house seen through its open door, a box at a time (an arched head takes a few)
GEO.doorway = new THREE.BoxGeometry(1, 1, 1);
const DOORWAYS = 64;

const folkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
folkMat.onBeforeCompile = instancedAO;
const flameMat = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb04a', emissiveIntensity: 1.5, roughness: 0.5 });
// near black by day (a hallway is darker than a room behind a window), lamp-lit at night: warm, but softer
// than a lit window, since a whole doorway of window glow would flood the street with bloom
const doorwayMat = new THREE.MeshBasicMaterial();
const DOORWAY_DAY = new THREE.Color(0.012, 0.013, 0.018), DOORWAY_NIGHT = new THREE.Color(0.5, 0.29, 0.11);
// a soft shadow, dark in the middle and clear at the rim. It darkens what is under it but leaves the frame's
// alpha alone (plain blending would let the page show through)
const shadowTex = (() => {
  const N = 32, d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const r = Math.min(1, Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / (N / 2));
    d.fill(Math.round(255 * 0.34 * (1 - r) ** 1.5), (j * N + i) * 4, (j * N + i) * 4 + 4);
  }
  const t = new THREE.DataTexture(d, N, N);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();
const shadowMat = new THREE.MeshBasicMaterial({ color: '#1d2a33', alphaMap: shadowTex, transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
// the iron of a lantern, the crust of a loaf, the wicker of a basket
const ITEM = { lantern: '#3b4148', bread: '#d9a35f', basket: '#b88a55' };

const parts = {};
const MAT = { flame: flameMat, shadow: shadowMat, doorway: doorwayMat };
for (const [name, geo] of Object.entries(GEO)) {
  const mesh = new THREE.InstancedMesh(geo, MAT[name] || folkMat, name === 'doorway' ? DOORWAYS : CAP * (name === 'leg' || name === 'arm' || name === 'hand' ? 2 : 1));
  mesh.castShadow = false; mesh.receiveShadow = !MAT[name];
  mesh.frustumCulled = false;   // instances move about the whole town; the mesh's own bounds don't follow them
  mesh.count = 0;
  if (name === 'shadow') { mesh.renderOrder = 2; WINFX.add(mesh); }
  scene.add(mesh);
  parts[name] = { mesh, n: 0 };
}

const R = new THREE.Matrix4(), H = new THREE.Matrix4(), A = new THREE.Matrix4(), T = new THREE.Matrix4(), out = new THREE.Matrix4();
const q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
const local = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => T.compose(pos.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), scl.set(s, s, s));
// how much light the person being posed gets: less as they step into a dark doorway
let lit = 1;
function put(name, m, hex) {
  const p = parts[name], i = p.n++;
  p.mesh.setMatrixAt(i, m);
  if (hex) p.mesh.setColorAt(i, col.set(hex).multiplyScalar(lit));
}

// one person's pose, built from their state: where they are, which way they face, how far into a stride,
// whether they sit, bend over, wave or carry something
function pose(p) {
  const L = p.look, s = p.size * p.vis, child = p.persona === 'child', elder = p.persona === 'elder';
  if (s < 0.01) return;
  lit = 0.02 + 0.98 * (1 - p.dim) ** 2;
  const sw = Math.sin(p.phase), g = p.gait, bob = Math.abs(Math.cos(p.phase)) * 0.014 * g;
  const breathe = Math.sin(folk.t * 2.1 + p.id) * 0.004 * (1 - g);
  const crouch = p.bend * 0.03, lift = p.sit * HIP * p.size;
  R.compose(pos.set(p.x, p.y + p.hop + bob - lift - crouch * p.size, p.z), q.setFromEuler(e.set(0, p.yaw, 0)), scl.set(s, s, s));
  // the shadow stays on the ground (or the doorstep), smaller while someone is up in the air
  put('shadow', out.compose(pos.set(p.x, p.sit > 0.01 ? GROUND + 0.02 : p.y + 0.005, p.z), q.identity(), scl.setScalar(0.12 * s * (1 - p.hop * 1.5))));
  // hips: a slight sway with each step, a lean forward to bend, an old person's stoop
  const lean = p.bend * 0.55 + (elder ? 0.14 : 0.04 * g) + p.sit * -0.05;
  H.multiplyMatrices(R, local(0, HIP + breathe, 0, lean, 0, sw * 0.05 * g));
  put('torso', H, L.coat);
  if (L.skirt) put('skirt', out.multiplyMatrices(R, local(0, HIP, 0, -p.sit * 1.1, 0, sw * 0.03 * g)), L.skirt);
  // legs swing opposite each other; sitting, they reach forward over the edge of the seat
  const stride = (child ? 0.6 : 0.48) * g;
  for (const k of [-1, 1]) {
    const rx = -p.sit * Math.PI / 2 + k * sw * stride + p.bend * 0.35;
    put('leg', out.multiplyMatrices(R, local(k * 0.03, HIP, 0, rx)), L.legs);
  }
  // arms swing against the legs; the right one (local -x) knocks, waves in conversation or holds out a
  // lantern, the left carries a basket or holds a loaf
  const carry = p.carry, lantern = p.lantern;
  for (const k of [-1, 1]) {
    let rx = -k * sw * 0.42 * g, rz = k * 0.1;
    if (p.sit > 0.5) rx = -0.7;
    if (p.bend > 0.5) rx = -0.9;
    if (k === -1 && p.gesture > 0.01) { rx = -1.25 * p.gesture + Math.sin(folk.t * 9) * 0.12 * p.gesture; rz = -0.25 * p.gesture; }
    if (k === 1 && carry === 'basket') rx = -k * sw * 0.08 * g;
    if (k === 1 && carry === 'bread') { rx = -0.3; rz = 0.05; }
    if (k === -1 && lantern && p.gesture < 0.3) rx = -0.55 - sw * 0.06 * g;
    A.multiplyMatrices(H, local(k * 0.068, SHOULDER, 0, rx, 0, rz));
    put('arm', A, L.coat);
    out.multiplyMatrices(A, local(0, -ARM, 0));
    put('hand', out, L.skin);
    // things held hang straight down from the hand, whichever way the arm swings
    const held = k === 1 ? carry === 'basket' && 'basket' : lantern && p.gesture < 0.3 && 'lantern';
    if (held) {
      pos.setFromMatrixPosition(out);
      T.compose(pos, q.setFromEuler(e.set(0, p.yaw, 0)), scl.set(s, s, s));
      put(held, T, ITEM[held]);
      if (held === 'lantern') put('flame', T);
    }
  }
  if (carry === 'bread') put('bread', out.multiplyMatrices(H, local(0.07, 0.11, 0.01, 0.2)), ITEM.bread);
  // the head turns toward whoever is near, nods in conversation, looks down into a shop window
  const hs = child ? 1.22 : 1;
  out.multiplyMatrices(H, local(0, NECK, 0, -lean * 0.7 + p.nod + p.bend * 0.25, p.head, 0, hs));
  put('head', out, L.skin);
  put('eyes', out, '#2b2522');
  put(L.hairStyle === 'bun' ? 'hairBun' : L.hairStyle === 'long' ? 'hairLong' : 'hairShort', out, L.hair);
  if (L.hat) put(L.hat, out, L.hatCol);
}

// An open door, seen from the street. Doors open inward, so the leaf turns away into the house and the
// doorway's dark widens from the latch side; what is left of the leaf narrows toward its hinge as it turns
// edge on. A pair of barn doors parts in the middle. The dark stands just proud of the door's hardware.
function doorway(D, k) {
  const L = D.door, c = Math.cos(smooth(k) * 1.4), nx = -D.dir[0], nz = -D.dir[1], tx = nz, tz = -nx;
  const ax = D.x - nx * L.at, az = D.z - nz * L.at, depth = 0.02, mid = L.front - depth / 2;
  const [g0, g1] = L.pair ? [-L.w * (1 - c), L.w * (1 - c)] : L.hinge > 0 ? [-L.w, L.w - 2 * L.w * c] : [2 * L.w * c - L.w, L.w];
  q.setFromEuler(e.set(0, Math.atan2(nx, nz), 0));
  const box = (lo, hi, y0, y1) => {
    if (hi - lo < 0.004 || parts.doorway.n >= DOORWAYS) return;
    const m = (lo + hi) / 2;
    put('doorway', out.compose(pos.set(ax + tx * m + nx * mid, (y0 + y1) / 2, az + tz * m + nz * mid), q, scl.set(hi - lo, y1 - y0, depth)));
  };
  box(g0, g1, L.base, L.base + L.h);
  for (let i = 0; i < 5 && L.arch; i++) {
    const w = L.arch * Math.sqrt(1 - ((i + 0.6) / 5) ** 2);
    box(Math.max(g0, -w), Math.min(g1, w), L.base + L.h + L.arch * i / 5, L.base + L.h + L.arch * (i + 1) / 5);
  }
}

export function animateFolk(dt, night) {
  if (!folk.world) return;
  stepFolk(folk, dt * folkClock.rate, night);
  for (const p of Object.values(parts)) p.n = 0;
  // each door as wide open as whoever is using it needs it
  const open = new Map();
  for (const p of folk.people) {
    const D = p.door > 0 && folk.world.byKey.get(p.at);
    if (D && D.door) open.set(D, Math.max(open.get(D) || 0, p.door));
  }
  for (const [D, k] of open) doorway(D, k);
  for (const p of folk.people) pose(p);
  for (const { mesh, n } of Object.values(parts)) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  flameMat.emissiveIntensity = 0.8 + 2.4 * night;
  doorwayMat.color.copy(DOORWAY_DAY).lerp(DOORWAY_NIGHT, night);
}
