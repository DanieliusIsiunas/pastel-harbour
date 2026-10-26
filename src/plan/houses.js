import { vAdj } from '../core/grid.js';
import { blocks, parseKey, topOf } from '../core/model.js';
import { PALETTE, ROOF_TONES, SHUTTERS } from '../core/palette.js';
import { hash } from '../core/util.js';

// ---------- R1: houses ----------
// Adjacent columns of the same base colour group into house-sized units. A house owns its traits,
// so every decision about doors, windows, roofs and chimneys is re-planned per house on each click.
export let houses = [], houseIdOf = new Map();
export const houseOf = v => houses[houseIdOf.get(v)];
export function computeHouses() {
  houses = []; houseIdOf = new Map();
  const baseCol = new Map();
  for (const k of blocks.keys()) {
    const [v, y] = parseKey(k);
    if (y < 1) continue;
    const cur = baseCol.get(v);
    if (!cur || y < cur.y) baseCol.set(v, { y, c: blocks.get(k).c });
  }
  const cols = [...baseCol.keys()].sort((a, b) => a - b);
  // whole building masses (same-colour connected columns) before they are split into house units:
  // a house's type is read from the mass it belongs to, so every bay of a long low block is a warehouse
  const massOf = new Map(), massInfo = [];
  for (const v0 of cols) {
    if (massOf.has(v0)) continue;
    const id = massInfo.length, c0 = baseCol.get(v0).c, q = [v0], members = [v0];
    massOf.set(v0, id);
    while (q.length) {
      const v = q.shift();
      for (const n of vAdj[v]) if (!massOf.has(n) && baseCol.has(n) && baseCol.get(n).c === c0) { massOf.set(n, id); q.push(n); members.push(n); }
    }
    massInfo.push({ cols: members.length, height: Math.max(...members.map(topOf)) });
  }
  for (const v0 of cols) {
    if (houseIdOf.has(v0)) continue;
    const c0 = baseCol.get(v0).c, cap = 2 + Math.floor(hash(v0, 0, 41, 1) * 3);
    const r = k => hash(v0, 0, 41, k);
    const h = {
      id: houses.length, anchor: v0, cols: [v0], mass: massInfo[massOf.get(v0)],
      roof: ROOF_TONES[Math.floor(r(3) * ROOF_TONES.length)],
      windows: r(4) < 0.45 ? 'joint' : r(4) < 0.8 ? 'pair' : 'mix',
      head: r(5), shutters: r(6) < 0.45, flowers: r(7) > 0.6, balcony: 0.08 + r(8) * 0.22,
      shop: r(9) < 0.4, shutterCol: SHUTTERS[Math.floor(r(10) * SHUTTERS.length)],
      awning: PALETTE[Math.floor(r(11) * PALETTE.length)].roof, quoins: r(13) < 0.55, ivy: r(14) < 0.4, planters: r(15) < 0.6,
    };
    houseIdOf.set(v0, h.id);
    const q = [v0];
    while (q.length && h.cols.length < cap) {
      const v = q.shift();
      for (const n of vAdj[v]) {
        if (h.cols.length >= cap) break;
        if (houseIdOf.has(n) || !baseCol.has(n) || baseCol.get(n).c !== c0) continue;
        houseIdOf.set(n, h.id); h.cols.push(n); q.push(n);
      }
    }
    h.doors = new Map();   // filled in by the planner
    // chimneys sit on the tallest columns
    const byHeight = h.cols.slice().sort((a, b) => topOf(b) - topOf(a) || hash(a, 0, 42, 1) - hash(b, 0, 42, 1));
    h.chimneys = new Set(byHeight.slice(0, h.cols.length >= 3 ? 2 : r(12) < 0.6 ? 1 : 0));
    houses.push(h);
  }
}
export const roofOf = v => (houseOf(v) || {}).roof || '#c95f3c';
