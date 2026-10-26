import { VERTS } from '../core/grid.js';
import { topOf } from '../core/model.js';
import { hash, norm2, sub2 } from '../core/util.js';
import { lanePair } from '../plan/analysis.js';

// ---------- spans across a lane ----------
// Two tall houses facing each other across open tile v can carry something between them: a washing line,
// bunting, string lights, a tie arch. A span runs from wall to wall: `a` and `b` are where the line of
// the two houses' centres meets each facade (the wall stands on the edge midpoint, where windows are
// centred, so lines start at a window the way real washing lines do). `top` is the lower roof line.
export function spanOf(v) {
  const pair = lanePair(v);
  if (!pair) return null;
  const [pa, pb] = pair.map(n => VERTS[n]), V = VERTS[v], dir = norm2(sub2(pb, pa)), nrm = [-dir[1], dir[0]];
  const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
  const s0 = 0.5 * ((V[0] - pa[0]) * dir[0] + (V[1] - pa[1]) * dir[1]), s1 = len - 0.5 * ((pb[0] - V[0]) * dir[0] + (pb[1] - V[1]) * dir[1]);
  if (s1 - s0 < 0.3) return null;
  const at = s => [pa[0] + dir[0] * s, pa[1] + dir[1] * s];
  return { a: at(s0), b: at(s1), dir, nrm, width: s1 - s0, top: Math.min(topOf(pair[0]), topOf(pair[1])) + 1 };
}
// points along a sagging line from a to b at height Y
export function catenary(sp, Y, sag, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    pts.push([sp.a[0] + (sp.b[0] - sp.a[0]) * u, Y - 4 * sag * u * (1 - u), sp.a[1] + (sp.b[1] - sp.a[1]) * u]);
  }
  return pts;
}
// a facade-like frame across the lane: s runs from wall a to wall b, d across the lane
export const spanFrame = sp => ({ a: sp.a, t: sp.dir, n: sp.nrm, L: sp.width });
export const SPAN_CTX = k => k === 'lane' || k === 'plaza';
// which span a lane carries, decided per tile so every kind gets its share: narrow lanes are sometimes
// braced by an arch; otherwise washing, bunting or lights
export function spanKind(v) {
  const sp = spanOf(v);
  if (!sp) return null;
  if (sp.width < 1.1 && hash(v, 0, 79, 1) < 0.22) return 'tieArch';
  const r = hash(v, 0, 79, 2);
  return r < 0.42 ? 'laundry' : r < 0.7 ? 'bunting' : 'stringLights';
}
