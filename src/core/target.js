import { VERTS, cells, footprintAt, nx4, pv4, vAdj, vCells, vFixed } from './grid.js';
import { has } from './model.js';
import { MAXY } from './palette.js';

// ---------- build targets ----------
export const valid = (v, y) => v >= 0 && !vFixed[v] && y >= 0 && y < MAXY && !has(v, y);
export const joinsStreet = v => vAdj[v].some(n => has(n, 0));
// The corners that would join v to a street it only meets at a cell centre: across each cell from v
// that holds a street, the two corners in between share a side with both. A tile placed there alone
// would touch the street at a single point, a pinch nobody can walk through.
export function bridgesTo(v) {
  if (joinsStreet(v)) return [];
  const out = [];
  for (const [ci, k] of vCells[v]) {
    const c = cells[ci].v;
    if (has(c[(k + 2) & 3], 0)) out.push(c[nx4(k)], c[pv4(k)]);
  }
  return out.filter(n => valid(n, 0));
}

// A click on the water lays a street on the footprint under the cursor, exactly the patch the water grid
// outlines, with two exceptions that keep streets joined along their sides. A footprint that would meet
// a street only at a corner gives way to the corner between them, so clicking along a diagonal lays a
// connected stepped street rather than a chain of tiles pinched together. Near a cell centre, where four
// footprints meet and a hair's difference decides, it prefers a footprint that joins a street along a
// side. A footprint that is already taken (the water in the cut-off corner of a rounded quay) passes to
// the nearest free corner of the same cell, so no click is wasted.
const HUB = 0.35;
export function groundTarget(x, z) {
  const f = footprintAt(x, z);
  if (!f) return null;
  const d2 = v => (VERTS[v][0] - x) ** 2 + (VERTS[v][1] - z) ** 2;
  const nearest = list => ({ v: list.reduce((a, b) => (d2(b) < d2(a) ? b : a)), y: 0 });
  const own = valid(f.v, 0);
  if (own && joinsStreet(f.v)) return { v: f.v, y: 0 };
  const bridges = own ? bridgesTo(f.v) : [];
  if (bridges.length) return nearest(bridges);
  if (f.hub > HUB) return own ? { v: f.v, y: 0 } : null;
  const free = f.cell.v.filter(v => valid(v, 0) && !bridgesTo(v).length), joined = free.filter(joinsStreet);
  if (joined.length) return nearest(joined);
  if (own) return { v: f.v, y: 0 };
  return free.length ? nearest(free) : null;
}
