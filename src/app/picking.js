import * as THREE from 'three';
import { commit } from './history.js';
import { updateGhost } from './input.js';
import { S } from './state.js';
import { WATER } from '../core/dims.js';
import { UVM, VERTS, cells, footprintAt, pv4, vAdj, vCells, vFixed, xz } from '../core/grid.js';
import { blocks, has, keyOf } from '../core/model.js';
import { MAXY, PALETTE } from '../core/palette.js';
import { P3 } from '../core/util.js';
import { chime, pluck, poof } from '../fx/sound.js';
import { face, makeBuilder, newMesh } from '../geom/builder.js';
import { WINFX } from '../render/materials.js';
import { camera, canvas, gridMat, scene } from '../render/stage.js';
import { disposeGroup, pickMesh, pickMeta, requestRegen } from '../render/town.js';

// ---------- picking ----------
export const ray = new THREE.Raycaster();
export const ndc = new THREE.Vector2();
export const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WATER + 0.1));
export const valid = (v, y) => v >= 0 && !vFixed[v] && y >= 0 && y < MAXY && !has(v, y);

export function pick(cx, cy, erase) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  const pd = ray.ray.intersectPlane(ground, p) ? ray.ray.origin.distanceTo(p) : Infinity;
  if (pd < Infinity) gridMat.uniforms.uCursor.value.copy(p);
  let hit = null;
  if (pickMesh) {
    const hs = ray.intersectObject(pickMesh, false);
    if (hs.length) hit = { d: hs[0].distance, m: pickMeta[hs[0].faceIndex], pt: hs[0].point };
  }
  if (erase) return hit ? { erase: true, v: hit.m.v, y: hit.m.y } : null;
  if (hit && hit.d <= pd + 1e-3) {
    const { v, y, t, cands } = hit.m;
    if (t === 'top') return valid(v, y + 1) ? { v, y: y + 1 } : null;
    if (t === 'bottom') return valid(v, y - 1) ? { v, y: y - 1 } : null;
    let best = -1, bd = Infinity;
    for (const c of cands) {
      const d = (VERTS[c][0] - hit.pt.x) ** 2 + (VERTS[c][1] - hit.pt.z) ** 2;
      if (d < bd && valid(c, y)) { bd = d; best = c; }
    }
    return best >= 0 ? { v: best, y } : null;
  }
  return pd < Infinity ? groundTarget(p.x, p.z) : null;
}
// A click on the water lays a street on the footprint under the cursor, exactly the patch the water grid
// outlines. Near a cell centre, where four footprints meet and a hair's difference decides, it prefers
// a footprint that joins a street along a side, so a line of clicks becomes one connected street rather
// than tiles touching at their corners. A footprint that is already taken (the water in the cut-off
// corner of a rounded quay) passes to the nearest free corner of the same cell, so no click is wasted.
const HUB = 0.35;
const joinsStreet = v => vAdj[v].some(n => has(n, 0));
function groundTarget(x, z) {
  const f = footprintAt(x, z);
  if (!f) return null;
  if (f.hub > HUB) return valid(f.v, 0) ? { v: f.v, y: 0 } : null;
  if (valid(f.v, 0) && joinsStreet(f.v)) return { v: f.v, y: 0 };
  const free = f.cell.v.filter(v => valid(v, 0)), joined = free.filter(joinsStreet);
  const d2 = v => (VERTS[v][0] - x) ** 2 + (VERTS[v][1] - z) ** 2;
  const nearest = list => list.reduce((a, b) => (d2(b) < d2(a) ? b : a));
  if (joined.length) return { v: nearest(joined), y: 0 };
  if (valid(f.v, 0)) return { v: f.v, y: 0 };
  return free.length ? { v: nearest(free), y: 0 } : null;
}
// what the hover preview shows is what a click builds: the click reuses the previewed target unless the
// pointer has moved since
let hover = null;
export function previewTarget(x, y, erase) {
  const t = pick(x, y, erase);
  hover = { x, y, erase, t };
  return t;
}

// hover ghost shaped like the house footprint around the corner
export const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
export const ghostLineMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
export const ghost = new THREE.Group(); scene.add(ghost);
export let ghostKey = '', ghostBase = 0.32, ghostFade = 1;
export function setGhost(t, erase) {
  const key = t ? t.v + ':' + t.y + ':' + erase : '';
  if (key === ghostKey) return;
  ghostKey = key;
  disposeGroup(ghost); ghost.clear();
  if (!t) return;
  const gb = makeBuilder(newMesh());
  const lp = [], y0 = t.y - (erase ? 0.03 : 0), y1 = t.y + 1 + (erase ? 0.03 : 0);
  for (const [ci, k] of vCells[t.v]) {
    const cell = cells[ci], V = cell.q[k];
    const a = xz(cell, UVM[k][0], UVM[k][1]), c = xz(cell, 0.5, 0.5), d = xz(cell, UVM[pv4(k)][0], UVM[pv4(k)][1]);
    const ref = [V[0], (y0 + y1) / 2, V[1]];
    face(gb, 'main', [P3(a, y1), P3(c, y1), P3(d, y1), P3(V, y1)], [1, 1, 1], ref);
    face(gb, 'main', [P3(a, y0), P3(c, y0), P3(c, y1), P3(a, y1)], [1, 1, 1], ref);
    face(gb, 'main', [P3(c, y0), P3(d, y0), P3(d, y1), P3(c, y1)], [1, 1, 1], ref);
    for (const yy of [y0 + 0.01, y1]) lp.push(a[0], yy, a[1], c[0], yy, c[1], c[0], yy, c[1], d[0], yy, d[1]);
    lp.push(c[0], y0, c[1], c[0], y1, c[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(gb.mesh.main.p, 3));
  const gm = new THREE.Mesh(geo, ghostMat);
  WINFX.add(gm);
  ghost.add(gm);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const gl2 = new THREE.LineSegments(lg, ghostLineMat);
  WINFX.add(gl2);
  ghost.add(gl2);
  const under = blocks.get(keyOf(t.v, t.y - 1));
  const mixedCol = t.y >= 2 && under ? under.c : S.nextMixed;
  ghostMat.color.set(erase ? '#d4574a' : (S.colorChoice === 'mixed' ? mixedCol : S.colorChoice));
  ghostBase = erase ? 0.45 : 0.32;
  ghostFade = 0;
  ghostLineMat.color.set(erase ? '#d4574a' : '#ffffff');
}

export function colorForPlacement() {
  if (S.colorChoice !== 'mixed') return S.colorChoice;
  return PALETTE[Math.floor(Math.random() * PALETTE.length)].wall;
}
S.nextMixed = colorForPlacement();

export function act(cx, cy, erase) {
  const same = hover && hover.erase === erase && Math.hypot(hover.x - cx, hover.y - cy) < 4;
  const t = same ? hover.t : pick(cx, cy, erase);
  hover = null;
  if (!t) return;
  if (t.erase) {
    requestRegen({ v: t.v, y: t.y, erase: true });
    commit(() => blocks.delete(keyOf(t.v, t.y)));
    pluck(t.y, true, 0.7);
    poof();
  } else {
    // in Mixed S.mode a new floor keeps the colour of the floor it stands on, so buildings stay whole
    const below = blocks.get(keyOf(t.v, t.y - 1));
    const c = S.colorChoice !== 'mixed' ? S.colorChoice : (t.y >= 2 && below ? below.c : S.nextMixed);
    S.nextMixed = colorForPlacement();
    requestRegen({ v: t.v, y: t.y, erase: false });
    commit(() => blocks.set(keyOf(t.v, t.y), { c }));
    pluck(t.y);
    chime();
  }
  ghostKey = '';
  updateGhost();
}

export function resetGhost() { ghostKey = ''; }
// the hover preview fades in and breathes
export function animateGhost(dt, t) {
  const breathe = 0.82 + 0.18 * Math.sin(t * 3.4);
  ghostFade = Math.min(1, ghostFade + dt * 7);
  ghostMat.opacity = ghostBase * breathe * ghostFade;
  ghostLineMat.opacity = (0.55 + 0.35 * breathe) * ghostFade;
}
