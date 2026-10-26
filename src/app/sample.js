import { pick } from './picking.js';
import { VERTS, vAdj, vFixed, vertexAt } from '../core/grid.js';
import { keyOf } from '../core/model.js';
import { PALETTE } from '../core/palette.js';
import { mulberry32 } from '../core/util.js';

// ---------- sample town ----------
export function graphPath(a, b) {
  const prev = new Map([[a, -1]]), q = [a];
  while (q.length) {
    const v = q.shift();
    if (v === b) break;
    for (const n of vAdj[v]) if (!prev.has(n) && !vFixed[n]) { prev.set(n, v); q.push(n); }
  }
  const path = [];
  for (let v = b; v !== -1 && prev.has(v); v = prev.get(v)) path.push(v);
  return path.reverse();
}
export function sampleTown(seed) {
  const m = new Map(), rnd = mulberry32(seed);
  const pick = () => PALETTE[Math.floor(rnd() * PALETTE.length)].wall;
  const ang = rnd() * Math.PI * 2;
  const isles = [
    { x: Math.cos(ang) * 2, z: Math.sin(ang) * 2, r: 5.2, h: 4 },
    { x: Math.cos(ang + 2.2) * 8.5, z: Math.sin(ang + 2.2) * 8.5, r: 3.6, h: 3 },
    { x: Math.cos(ang - 2.0) * 9, z: Math.sin(ang - 2.0) * 9, r: 3, h: 2 },
  ];
  // every island vertex is paved; winding lanes stay open, the rest carries houses
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const lane = (x, z) => Math.abs(Math.sin(x * 0.75 + ph[0]) + Math.cos(z * 0.7 + ph[1]) + 0.6 * Math.sin((x - z) * 0.45 + ph[2])) < 0.38;
  const heightOf = new Map();
  for (let v = 0; v < VERTS.length; v++) {
    if (vFixed[v]) continue;
    const [x, z] = VERTS[v];
    for (const s of isles) {
      const d = Math.hypot(x - s.x, z - s.z) + (rnd() - 0.5) * 1.6;
      if (d >= s.r) continue;
      m.set(keyOf(v, 0), { c: '#ddd5c7' });
      if (lane(x, z) || (d > s.r - 0.9 && rnd() < 0.35)) break;   // streets and open quays
      let H = Math.max(1, Math.round(s.h * (1 - d / s.r) + rnd() * 1.3));
      if (d < 0.7) H = s.h + 2;
      heightOf.set(v, Math.max(heightOf.get(v) || 0, H));
      break;
    }
  }
  for (const [v, H] of heightOf) {
    let c = pick();
    for (let y = 1; y <= H; y++) m.set(keyOf(v, y), { c });
  }
  // arcades over a few lanes: an upper floor bridging the street between two houses
  for (const [v, H] of heightOf) {
    if (H < 2 || rnd() > 0.25) continue;
    for (const n of vAdj[v]) if (m.has(keyOf(n, 0)) && !heightOf.has(n) && vAdj[n].some(w => w !== v && (heightOf.get(w) || 0) >= 2)) { m.set(keyOf(n, 2), { c: m.get(keyOf(v, 2)).c }); break; }
  }
  // bridges between the islands: a floor at level 1 standing on piers in the water
  for (const [a, b, col] of [[0, 1, '#f4f1ec'], [0, 2, '#f2d0a4']]) {
    const va = vertexAt(isles[a].x, isles[a].z, 3), vb = vertexAt(isles[b].x, isles[b].z, 3);
    if (va < 0 || vb < 0) continue;
    for (const v of graphPath(va, vb)) if (!m.has(keyOf(v, 0))) m.set(keyOf(v, 1), { c: col });
  }
  return m;
}
