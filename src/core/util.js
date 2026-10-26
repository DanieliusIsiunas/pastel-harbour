import * as THREE from 'three';

// ---------- utils ----------
export function hash(a, b, c, d) {
  let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761), 1597334677);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const _col = new THREE.Color();
export function lin(hex, k = 1) { _col.set(hex); return [_col.r * k, _col.g * k, _col.b * k]; }

export function shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }
// 2D helpers on the xz plane
export const l2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const norm2 = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
export const P3 = (p, y) => [p[0], y, p[1]];
export function outward(a, b, inside) {
  const t = norm2(sub2(b, a)); let n = [t[1], -t[0]];
  const m = l2(a, b, 0.5);
  if (n[0] * (inside[0] - m[0]) + n[1] * (inside[1] - m[1]) > 0) n = [-n[0], -n[1]];
  return n;
}

// wall frame: s along the wall from its joint, d outward, absolute y
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function upNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  if (n[1] < 0) n = n.map(x => -x);
  const l = Math.hypot(...n) || 1;
  return n.map(x => x / l);
}
export const lift = (p, n, k = 0.006) => [p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k];
export const easeOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const smooth = t => t * t * (3 - 2 * t);
