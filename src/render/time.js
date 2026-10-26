import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { pluck } from '../fx/sound.js';
import { foamMat, litMat, roomDarkMat, roomLitMat } from './materials.js';
import { bloom } from './post.js';
import { gridMat, hemi, scene, sky, sun, water } from './stage.js';

// ---------- M3: time of day ----------
export const TIMES = {
  Day:   { top: '#6f9fa9', horizon: '#86b1b8', sun: '#ffe4c0', sunI: 3.3, sunPos: [14, 22, 9],  hs: '#fff1df', hg: '#c4b196', hI: 2.0, water: '#478893', glow: 0,   glass: '#41546b', bloom: 0.0, foam: 0.55, foamCol: '#ffffff' },
  Dusk:  { top: '#6d78b3', horizon: '#f7c59f', sun: '#ffad73', sunI: 1.9, sunPos: [26, 8, -6],  hs: '#f6cbb2', hg: '#9a8796', hI: 1.8, water: '#86a3cc', glow: 0.9, glass: '#ffcf8a', bloom: 0.35, foam: 0.5, foamCol: '#ffe6d6' },
  Night: { top: '#0b1430', horizon: '#2a3c66', sun: '#a9c1ff', sunI: 1.0, sunPos: [-12, 20, 10], hs: '#7088c0', hg: '#34436a', hI: 1.8, water: '#1f3659', glow: 1.7, glass: '#ffd38f', bloom: 0.55, foam: 0.35, foamCol: '#7f90b8' },
};
export const TIME_ORDER = ['Day', 'Dusk', 'Night'];
export let timeName = 'Day';
export const cur = {};
export function toState(p) {
  return {
    top: new THREE.Color(p.top), horizon: new THREE.Color(p.horizon), sun: new THREE.Color(p.sun), hs: new THREE.Color(p.hs),
    hg: new THREE.Color(p.hg), water: new THREE.Color(p.water), glass: new THREE.Color(p.glass), foamCol: new THREE.Color(p.foamCol),
    sunPos: new THREE.Vector3(...p.sunPos), sunI: p.sunI, hI: p.hI, glow: p.glow, bloom: p.bloom, foam: p.foam,
  };
}
Object.assign(cur, toState(TIMES.Day));
export let timeFrom = null, timeTo = null, timeStart = 0;
export function cycleTime() {
  timeName = TIME_ORDER[(TIME_ORDER.indexOf(timeName) + 1) % TIME_ORDER.length];
  document.getElementById('time').textContent = timeName;
  timeFrom = { ...cur, top: cur.top.clone(), horizon: cur.horizon.clone(), sun: cur.sun.clone(), hs: cur.hs.clone(), hg: cur.hg.clone(), water: cur.water.clone(), glass: cur.glass.clone(), foamCol: cur.foamCol.clone(), sunPos: cur.sunPos.clone() };
  timeTo = toState(TIMES[timeName]);
  timeStart = performance.now();
  pluck(timeName === 'Night' ? 7 : timeName === 'Dusk' ? 5 : 9);
}
export const _roomGlow = new THREE.Color(2.4, 1.55, 0.7);
export function applyTime() {
  sky.material.uniforms.top.value.copy(cur.top);
  sky.material.uniforms.horizon.value.copy(cur.horizon);
  scene.fog.color.copy(cur.horizon);
  sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos);
  hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = cur.hI;
  water.material.uniforms.uWater.value.copy(cur.water);
  water.material.uniforms.uFog.value.copy(cur.horizon);
  foamMat.color.copy(cur.foamCol);
  litMat.color.copy(cur.glass); litMat.emissiveIntensity = cur.glow;
  roomLitMat.color.setRGB(0.045, 0.055, 0.075).lerp(_roomGlow, Math.min(1, cur.glow / 1.7));
  roomDarkMat.color.setRGB(0.035, 0.042, 0.06).multiplyScalar(1 - 0.45 * Math.min(1, cur.glow / 1.7));
  bloom.strength = cur.bloom;
  bloom.enabled = cur.bloom > 0.005;
  gridMat.uniforms.uBase.value = 0.07 - 0.064 * Math.min(1, cur.glow / 1.7);
}

export function updateTime(now) {
  if (timeTo) {
    const p = Math.min(1, (now - timeStart) / 1600), e = smooth(p);
    for (const k of ['top', 'horizon', 'sun', 'hs', 'hg', 'water', 'glass', 'foamCol']) cur[k].copy(timeFrom[k]).lerp(timeTo[k], e);
    cur.sunPos.copy(timeFrom.sunPos).lerp(timeTo.sunPos, e);
    for (const k of ['sunI', 'hI', 'glow', 'bloom', 'foam']) cur[k] = timeFrom[k] + (timeTo[k] - timeFrom[k]) * e;
    if (p >= 1) timeTo = null;
  }
  applyTime();
}
export const timeBusy = () => !!timeTo;
