import * as THREE from 'three';
import { WATER } from '../core/dims.js';
import { hash } from '../core/util.js';
import { makeBuilder, newMesh } from '../geom/builder.js';
import { sailboat } from '../geom/boats.js';
import { WINFX } from '../render/materials.js';
import { scene } from '../render/stage.js';
import { meshesFrom } from '../render/town.js';

// ---------- life: boats and gulls ----------
export const boats = [], gulls = [];
export function simpleBox(parent, color, sx, sy, sz, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  o.position.set(x, y, z); parent.add(o); return o;
}
// A wake: two arms of foam spreading from the bow shoulders and a wash behind the stern, fading with
// distance. It lies flat on the water while the boat heels and bobs above it, and stays out of the
// reflection (a mirrored film of foam would read as a second, sunken wake).
const wakeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
function wake(L, B, seed) {
  const P = [], C = [];
  // each band is three lines lengthwise: clear at both edges and foam along the middle, so it has no hard rim
  const strip = (rows, alpha) => {
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < 2; j++) {
      const a0 = rows[i][j], a1 = rows[i][j + 1], b0 = rows[i + 1][j], b1 = rows[i + 1][j + 1];
      const al = (r, c) => (c === 1 ? alpha(r / (rows.length - 1), r) : 0);
      for (const [p, r, c] of [[a0, i, j], [b0, i + 1, j], [b1, i + 1, j + 1], [a0, i, j], [b1, i + 1, j + 1], [a1, i, j + 1]]) {
        P.push(p[0], 0, p[1]); C.push(1, 1, 1, al(r, c));
      }
    }
  };
  const N = 14, back = 2.4 * L, jag = k => 0.75 + 0.5 * hash(seed, k, 0, 135);
  for (const s of [-1, 1]) strip(Array.from({ length: N + 1 }, (_, i) => {
    const x = L * 0.32 - back * i / N, z = s * (B * 0.9 + (L * 0.32 - x) * 0.3), w = 0.03 + 0.09 * i / N;
    return [[x, z - s * w * 0.3], [x, z + s * w * 0.35], [x, z + s * w]];
  }), (u, k) => 0.7 * (1 - u) ** 1.6 * jag(k));
  strip(Array.from({ length: N + 1 }, (_, i) => {
    const x = -L * 0.5 - back * 0.7 * i / N, w = B * 0.8 + 0.14 * i / N;
    return [[x, -w], [x, 0], [x, w]];
  }), (u, k) => 0.35 * (1 - u) ** 2 * jag(k + 20));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
  const m = new THREE.Mesh(geo, wakeMat);
  m.position.y = 0.013; m.renderOrder = 2;
  WINFX.add(m);
  return m;
}
// Three boats sail round the bay, each rigged its own way. A boat sits in the water with its keel under
// it, heels away from the wind its sail is filled with, and pitches gently as it goes; the wake shows
// it is under way.
export function makeBoat(rig, radius, speed, phase) {
  const m = newMesh(), h = sailboat(makeBuilder(m), rig);
  const root = new THREE.Group(), heel = meshesFrom(m);
  heel.traverse(o => { o.castShadow = false; });   // the shadow map is only redrawn on clicks: a moving boat would leave its shadow behind
  root.add(heel, wake(h.L, h.B, phase * 100));
  scene.add(root);
  boats.push({ root, heel, radius, speed, phase });
}
makeBoat('cat', 19, 0.04, 0);
makeBoat('sloop', 22, -0.03, 2.4);
makeBoat('lateen', 25, 0.025, 4.1);
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  const wl = simpleBox(g, '#ffffff', 0.45, 0.03, 0.14, -0.22, 0, 0);
  const wr = simpleBox(g, '#ffffff', 0.45, 0.03, 0.14, 0.22, 0, 0);
  simpleBox(g, '#ffffff', 0.12, 0.08, 0.3, 0, 0, 0);
  g.traverse(o => { o.castShadow = false; });
  wl.geometry.translate(-0.0, 0, 0);
  scene.add(g);
  gulls.push({ g, wl, wr, r: 6 + Math.random() * 10, h: 7 + Math.random() * 5, s: 0.15 + Math.random() * 0.15, p: Math.random() * 6.28, f: 5 + Math.random() * 3 });
}

export function animateLife(t) {
  for (const bt of boats) {
    // the bow points along the circle the boat sails, whichever way round it goes
    const ang = bt.phase + t * bt.speed;
    bt.root.position.set(Math.cos(ang) * bt.radius, WATER, Math.sin(ang) * bt.radius);
    bt.root.rotation.y = -ang + (bt.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
    bt.heel.position.y = Math.sin(t * 1.3 + bt.phase) * 0.012;
    bt.heel.rotation.x = 0.12 + Math.sin(t * 0.9 + bt.phase) * 0.025;
    bt.heel.rotation.z = Math.sin(t * 1.1 + bt.phase) * 0.025;
  }
  for (const gl of gulls) {
    const a = gl.p + t * gl.s;
    gl.g.position.set(Math.cos(a) * gl.r, gl.h + Math.sin(t * 0.7 + gl.p) * 0.6, Math.sin(a) * gl.r);
    gl.g.rotation.y = -a;
    const flap = Math.sin(t * gl.f + gl.p) * 0.45;
    gl.wl.rotation.z = flap; gl.wr.rotation.z = -flap;
  }
}
