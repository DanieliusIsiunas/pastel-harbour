import * as THREE from 'three';
import { GROUND, WATER } from '../core/dims.js';
import { reduceMotion } from '../core/env.js';
import { VERTS } from '../core/grid.js';
import { blocks, parseKey } from '../core/model.js';
import { camera, controls } from './stage.js';

// ---------- camera director ----------
// The camera keeps the whole town in view, the way Townscaper's does: a new town starts close, and as it
// grows wider or taller the camera eases back so every piece stays on screen with a little air around
// it; when it shrinks, the camera comes back in, more slowly. The player keeps full control: orbiting is
// untouched, and zooming and panning are remembered as offsets from the framing (zoom as a multiplier,
// pan as a shift), so the director never fights a hand on the controls. Zooming zooms toward the cursor.
// Above all the camera holds still: building inside the view moves nothing. It moves only when the town
// no longer fits (and then with some headroom, so the next few pieces don't move it again), or when the
// town has become much smaller than the view.
const FRAME = { center: new THREE.Vector3(0, 1.4, 0), dist: 14 };
const state = { zoom: 1, pan: new THREE.Vector3(), lastDist: 0, lastTarget: new THREE.Vector3(), ready: false, manual: false };
// the screen share the town may fill across and up; the dock and the title card take some of the height,
// so the frame is nudged up by LIFT
const TAU_OUT = 0.6, TAU_IN = 1.4, TAU_TARGET = 0.8, MARGIN_H = 0.8, MARGIN_V = 0.7, LIFT = -0.04;
// a refit leaves 12% headroom; the camera comes back in only once the town needs under 70% of the view
const HEADROOM = 1.12, SHRINK = 0.7;
const ZOOM_MIN = 0.3, ZOOM_MAX = 2.2, DIST_MIN = 3.2, DIST_MAX = 120;

controls.minDistance = DIST_MIN;
controls.maxDistance = DIST_MAX;
controls.zoomToCursor = true;

// The town's silhouette as points: the four corners of every column's footprint at the waterline and at
// its roof (spire tips included). Framing projects these into the current view and solves for the
// distance at which every point lands inside the screen, so a wide, low town fills a landscape screen and
// a portrait phone still sees its full width.
let PTS = [];
const BASE = new THREE.Vector3();
function silhouette() {
  const cols = new Map();
  for (const k of blocks.keys()) { const [v, y] = parseKey(k); cols.set(v, Math.max(cols.get(v) ?? -1, y)); }
  PTS = [];
  for (const [v, y] of cols) {
    const [x, z] = VERTS[v], roof = y === 0 ? GROUND + 0.1 : y + 1.6;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) PTS.push(x + dx, WATER, z + dz, x + dx, roof, z + dz);
  }
  // an empty harbour still frames the patch of water around the middle
  if (!PTS.length) for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) PTS.push(dx, WATER, dz, dx, GROUND + 0.6, dz);
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < PTS.length; i += 3) { sx += PTS[i]; sy += PTS[i + 1]; sz += PTS[i + 2]; }
  BASE.set(sx, sy, sz).multiplyScalar(3 / PTS.length);
}
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Vector3();
function fit() {
  // view axes for the current orbit: w points from the town toward the camera
  _w.copy(camera.position).sub(controls.target).normalize();
  _u.crossVectors(camera.up, _w).normalize(); _v.crossVectors(_w, _u);
  // (a hidden or zero-sized canvas has no aspect; then it is treated as square)
  const aspect = camera.aspect > 0 && isFinite(camera.aspect) ? camera.aspect : 1;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * MARGIN_V, th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect * MARGIN_H;
  // centre the silhouette on screen (measured flat, across the view), then solve the distance
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < PTS.length; i += 3) {
    _q.set(PTS[i], PTS[i + 1], PTS[i + 2]).sub(BASE);
    const x = _q.dot(_u), y = _q.dot(_v);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const center = BASE.clone().addScaledVector(_u, (x0 + x1) / 2).addScaledVector(_v, (y0 + y1) / 2 + LIFT * (y1 - y0));
  return { center, dist: needed(center, th, tv) };
}
// the distance at which every silhouette point, seen from this centre along the current view, is on screen
function needed(center, th, tv) {
  if (th === undefined) {
    _w.copy(camera.position).sub(controls.target).normalize();
    _u.crossVectors(camera.up, _w).normalize(); _v.crossVectors(_w, _u);
    const aspect = camera.aspect > 0 && isFinite(camera.aspect) ? camera.aspect : 1, t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    tv = t * MARGIN_V; th = t * aspect * MARGIN_H;
  }
  let d = 0;
  for (let i = 0; i < PTS.length; i += 3) {
    _q.set(PTS[i], PTS[i + 1], PTS[i + 2]).sub(center);
    const depth = _q.dot(_w);
    d = Math.max(d, depth + Math.abs(_q.dot(_u)) / th, depth + Math.abs(_q.dot(_v)) / tv);
  }
  return THREE.MathUtils.clamp(d, 6.5, 95);
}
// keep the framing unless it no longer shows the whole town, or the town has shrunk well inside it
function reframe(force) {
  const f = fit();
  if (force || !state.ready) { FRAME.center.copy(f.center); FRAME.dist = f.dist * HEADROOM; return; }
  // looking at the whole town: the view the player actually has is the framing plus their pan
  const view = FRAME.center.clone().add(state.zoom >= 0.9 ? state.pan : _zero), have = FRAME.dist * Math.max(1, state.zoom);
  if (needed(view) > have) {
    FRAME.center.copy(f.center); FRAME.dist = f.dist * HEADROOM;
    if (state.zoom >= 0.9) state.pan.set(0, 0, 0);
  } else if (f.dist * HEADROOM < FRAME.dist * SHRINK) { FRAME.center.copy(f.center); FRAME.dist = f.dist * HEADROOM; }
}
const _zero = new THREE.Vector3();
// after the player lets go of an orbit the same rule applies (never during one, so the view doesn't breathe):
// turning a long town end-on may need a step back; otherwise nothing moves
controls.addEventListener('end', () => { if (state.ready && !state.manual) reframe(); });
// focus: the block just built or removed ({ v, y }), if any
export function frameTown(focus) {
  silhouette();
  reframe();
  if (focus && state.zoom < 0.9) {
    // zoomed in on a corner of the town: the camera stays where the player is working, and follows a new
    // piece that lands near the edge of the screen
    const p = new THREE.Vector3(VERTS[focus.v][0], focus.y === 0 ? GROUND : focus.y + 0.5, VERTS[focus.v][1]), s = p.clone().project(camera);
    if (Math.abs(s.x) > 0.6 || Math.abs(s.y) > 0.6) state.pan.add(p.sub(controls.target).multiplyScalar(0.5).setY(0));
  }
  if (!state.ready) {
    // the first view starts a little closer and eases back: the town settles into the frame
    state.ready = true;
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(FRAME.center);
    camera.position.copy(FRAME.center).addScaledVector(dir, FRAME.dist * (reduceMotion ? 1 : 0.85));
    state.lastDist = camera.position.distanceTo(controls.target);
    state.lastTarget.copy(controls.target);
  }
}
addEventListener('resize', () => { if (state.ready) reframe(true); });

// runs every frame after the controls: first reads what the player did since the last frame (any change
// of distance or target that the director did not make), then eases toward the framing
const _d = new THREE.Vector3(), _t = new THREE.Vector3();
export function directCamera(dt) {
  if (!state.ready || state.manual) return;
  if (!isFinite(camera.position.x + controls.target.x)) { camera.position.set(24, 18.5, 30); controls.target.copy(FRAME.center); state.lastDist = 0; }
  const dist = camera.position.distanceTo(controls.target);
  if (state.lastDist > 0 && Math.abs(dist - state.lastDist) > 1e-4) state.zoom = THREE.MathUtils.clamp(state.zoom * dist / state.lastDist, ZOOM_MIN, ZOOM_MAX);
  _t.copy(controls.target).sub(state.lastTarget);
  if (_t.lengthSq() > 1e-8) state.pan.add(_t);
  const goalDist = THREE.MathUtils.clamp(FRAME.dist * state.zoom, DIST_MIN, DIST_MAX);
  const ease = tau => (reduceMotion ? 1 : 1 - Math.exp(-dt / tau));
  const nd = dist + (goalDist - dist) * ease(goalDist > dist ? TAU_OUT : TAU_IN);
  _t.copy(FRAME.center).add(state.pan).sub(controls.target).multiplyScalar(ease(TAU_TARGET));
  _d.copy(camera.position).sub(controls.target).normalize();
  controls.target.add(_t);
  camera.position.copy(controls.target).addScaledVector(_d, nd);
  state.lastDist = nd;
  state.lastTarget.copy(controls.target);
}
// dev views take the camera; auto() hands it back
export function setManualCamera(on) {
  state.manual = on;
  if (!on) { state.zoom = 1; state.pan.set(0, 0, 0); state.lastDist = camera.position.distanceTo(controls.target); state.lastTarget.copy(controls.target); }
}
export const cameraState = () => ({ center: FRAME.center.toArray().map(n => +n.toFixed(2)), frameDist: +FRAME.dist.toFixed(2),
  dist: +camera.position.distanceTo(controls.target).toFixed(2), zoom: +state.zoom.toFixed(2), pan: state.pan.toArray().map(n => +n.toFixed(2)) });
