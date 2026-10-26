import * as THREE from 'three';
import { WATER } from '../core/dims.js';
import { C } from '../core/palette.js';
import { scene } from '../render/stage.js';

// ---------- life: boats and gulls ----------
export const boats = [], gulls = [];
export function simpleBox(parent, color, sx, sy, sz, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  o.position.set(x, y, z); parent.add(o); return o;
}
export function makeBoat(color, radius, speed, phase) {
  const b = new THREE.Group();
  simpleBox(b, C.wood, 1.0, 0.2, 0.4, 0, 0.1, 0);
  simpleBox(b, color, 1.04, 0.06, 0.44, 0, 0.23, 0);
  simpleBox(b, C.trim, 0.04, 0.8, 0.04, 0.05, 0.6, 0);
  const sail = simpleBox(b, C.trim, 0.5, 0.6, 0.02, 0.28, 0.62, 0);
  sail.rotation.z = 0.1;
  scene.add(b);
  boats.push({ b, radius, speed, phase });
}
makeBoat('#e8a3a0', 19, 0.04, 0);
makeBoat('#9cc5e3', 22, -0.03, 2.4);
makeBoat('#f5e6b8', 25, 0.025, 4.1);
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
    const ang = bt.phase + t * bt.speed;
    bt.b.position.set(Math.cos(ang) * bt.radius, WATER + 0.03 + Math.sin(t * 1.3 + bt.phase) * 0.05, Math.sin(ang) * bt.radius);
    bt.b.rotation.y = -ang + (bt.speed > 0 ? 0 : Math.PI);
    bt.b.rotation.x = Math.sin(t * 1.1 + bt.phase) * 0.05;
  }
  for (const gl of gulls) {
    const a = gl.p + t * gl.s;
    gl.g.position.set(Math.cos(a) * gl.r, gl.h + Math.sin(t * 0.7 + gl.p) * 0.6, Math.sin(a) * gl.r);
    gl.g.rotation.y = -a;
    const flap = Math.sin(t * gl.f + gl.p) * 0.45;
    gl.wl.rotation.z = flap; gl.wr.rotation.z = -flap;
  }
}
