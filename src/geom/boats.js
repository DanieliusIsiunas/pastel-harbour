import { WATER } from '../core/dims.js';
import { vAdj } from '../core/grid.js';
import { blocks, has, keyOf } from '../core/model.js';
import { C, PALETTE, ROOF_OF } from '../core/palette.js';
import { hash, lerp3, lin, shade } from '../core/util.js';
import { blob, boxAt, face, rod, wb } from './builder.js';

// ---------- boats ----------
// Every boat is a lofted hull: cross-sections along its length (keel, turn of the bilge, top of the paint,
// sheer) skinned with planks, closed by a pointed stem or a flat transom. A hull floats with some draft, as
// a real one does, so its reflection starts at the waterline instead of hanging under a strip of water. Open
// boats keep their floorboards above the waterline: below it the harbour water would be drawn over them.
const STATIONS = 10;
// a boat's own frame: x along the boat (stern at -L/2, bow at +L/2), y up from the waterline, z across
export const frame = (x, z, t, y0 = WATER) => ({ a: [x, z], t, n: [-t[1], t[0]], y0 });
export const at = (F, x, y, z) => [F.a[0] + F.t[0] * x + F.n[0] * z, F.y0 + y, F.a[1] + F.t[1] * x + F.n[1] * z];

export function hull(bld, F, H) {
  const { L, B, D, T, spring = 0.02, stem = 0, rocker = 0.5, transom = 0, th = 0.012, stripe = 0.02, floor = 0.02 } = H;
  // a transom cuts the rounded plan off at the stern where it is still `transom` of the full beam
  const u0 = transom > 0 ? Math.asin(Math.pow(transom, 1 / 0.6)) / Math.PI : 0;
  const w = s => B * Math.pow(Math.max(0, Math.sin(Math.PI * (u0 + (1 - u0) * s))), 0.6);
  const top = s => D + spring * (2 * s - 1) ** 2 + stem * s ** 6;
  const bot = s => -T * (1 - rocker * (2 * s - 1) ** 2);
  const X = s => (s - 0.5) * L, P = (x, y, z) => at(F, x, y, z);
  const sec = (s, k) => {
    const x = X(s), b = bot(s), t = top(s), ww = w(s) * k;
    return [P(x, b, 0), P(x, b + (t - b) * 0.25, ww * 0.72), P(x, t - stripe, ww * 0.97), P(x, t, ww)];
  };
  // inside: the planking's inner face from the sheer down to the floorboards, which rise toward the ends
  // where the bilge does
  const inner = (s, k) => {
    const x = X(s) + (transom > 0 && s === 0 ? th : 0), t = top(s), wi = Math.max(0, w(s) - th) * k;
    const fy = Math.max(floor, bot(s) + (t - bot(s)) * 0.25 + 0.008);
    return [P(x, t, wi), P(x, fy, wi * 0.7)];
  };
  const paint = [lin(H.bottom), lin(H.hull), lin(H.band)], rim = lin(H.rim), inside = lin(H.inside), boards = lin(H.boards);
  for (let i = 0; i < STATIONS; i++) {
    const s0 = i / STATIONS, s1 = (i + 1) / STATIONS, xm = X((s0 + s1) / 2), mid = P(xm, (bot(s0) + top(s0)) / 2, 0);
    for (const k of [-1, 1]) {
      const A = sec(s0, k), Bq = sec(s1, k), a = inner(s0, k), b = inner(s1, k);
      for (let j = 0; j < 3; j++) face(bld, 'main', [A[j], Bq[j], Bq[j + 1], A[j + 1]], paint[j], mid);
      face(bld, 'main', [A[3], Bq[3], b[0], a[0]], rim, P(xm, -1, 0));
      face(bld, 'main', [a[0], b[0], b[1], a[1]], inside, P(xm, 0, k * 3 * B));
    }
    face(bld, 'main', [inner(s0, 1)[1], inner(s1, 1)[1], inner(s1, -1)[1], inner(s0, -1)[1]], boards, P(xm, -1, 0));
  }
  if (transom > 0) {
    const A = sec(0, 1), Z = sec(0, -1), a = inner(0, 1), z = inner(0, -1), aft = P(X(0) - 1, 0, 0), fwd = P(X(0) + 1, 0, 0);
    face(bld, 'main', [A[0], A[1], Z[1]], paint[0], fwd);
    face(bld, 'main', [A[1], A[2], Z[2], Z[1]], paint[1], fwd);
    face(bld, 'main', [A[2], A[3], Z[3], Z[2]], paint[2], fwd);
    face(bld, 'main', [A[3], Z[3], z[0], a[0]], rim, P(X(0), -1, 0));
    face(bld, 'main', [a[0], z[0], z[1], a[1]], inside, aft);
  }
  // a thin ring of foam where the hull meets still water, as the quay walls have
  if (H.foam) {
    const wl = s => {
      const b = bot(s), t = top(s), pts = [[0, b], [w(s) * 0.72, b + (t - b) * 0.25], [w(s) * 0.97, t - stripe]];
      for (let j = 0; j < 2; j++) if (pts[j][1] <= 0 && pts[j + 1][1] > 0) return pts[j][0] + (pts[j + 1][0] - pts[j][0]) * (-pts[j][1] / (pts[j + 1][1] - pts[j][1]));
      return b > 0 ? 0 : w(s);
    };
    const foam = lin(C.foam), Y = 0.014;
    for (let i = 0; i < STATIONS; i++) {
      const s0 = i / STATIONS, s1 = (i + 1) / STATIONS, w0 = wl(s0), w1 = wl(s1);
      for (const k of [-1, 1]) face(bld, 'foam', [P(X(s0), Y, k * (w0 + 0.004)), P(X(s1), Y, k * (w1 + 0.004)), P(X(s1), Y, k * (w1 + 0.03)),
        P(X(s0), Y, k * (w0 + 0.03))], foam, P(X(s0), -1, 0));
    }
    if (transom > 0) face(bld, 'foam', [P(X(0), Y, wl(0) + 0.03), P(X(0), Y, -wl(0) - 0.03), P(X(0) - 0.026, Y, -wl(0) - 0.03), P(X(0) - 0.026, Y, wl(0) + 0.03)], foam, P(X(0), -1, 0));
  }
  // a point on the painted side between the bilge (f = 0) and the stripe (f = 1)
  const side = (s, k, f) => { const S = sec(s, k); return lerp3(S[1], S[2], f); };
  return { L, B, w, top, bot, X, P, side };
}

// a diamond laid on the hull's side, lifted off it by `lift` so it never shares the planking's plane
function onSide(bld, h, F, s, k, f, ds, df, lift, col) {
  const q = [h.side(s - ds, k, f), h.side(s, k, f + df), h.side(s + ds, k, f), h.side(s, k, f - df)];
  const u = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]], v = [q[1][0] - q[3][0], q[1][1] - q[3][1], q[1][2] - q[3][2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) * Math.sign(n[0] * F.n[0] * k + n[2] * F.n[1] * k || 1);
  n = n.map(c => c / l);
  const pts = q.map(p => [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift]), c = h.side(s, k, f);
  face(bld, 'main', pts, col, [c[0] - n[0], c[1] - n[1], c[2] - n[2]]);
}
// a sail or flag seen from both sides: the same quad twice, facing each way
function both(bld, pts, col) {
  const c = [0, 1, 2].map(i => pts.reduce((m, p) => m + p[i], 0) / pts.length);
  const a = pts[0], b = pts[1], d = pts[pts.length - 1];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  face(bld, 'main', pts, col, [c[0] - n[0], c[1] - n[1], c[2] - n[2]]);
  face(bld, 'main', pts, col, [c[0] + n[0], c[1] + n[1], c[2] + n[2]]);
}

// Whose boat it is: the house nearest the quay tile, found by walking out along the street. A boat is
// painted like its owner's house, so the harbour reads as belonging to its town.
export function ownerOf(v) {
  let ring = [v];
  const seen = new Set(ring);
  for (let d = 0; d < 4 && ring.length; d++) {
    const homes = [...new Set(ring.flatMap(u => vAdj[u].filter(n => has(n, 1))))].sort((a, b) => a - b);
    if (homes.length) return blocks.get(keyOf(homes[Math.floor(hash(v, d, 0, 130) * homes.length)], 1)).c;
    ring = ring.flatMap(u => vAdj[u].filter(n => has(n, 0) && !seen.has(n) && seen.add(n)));
  }
  return PALETTE[Math.floor(hash(v, 0, 1, 130) * PALETTE.length)].wall;
}
const roofOf = wall => ROOF_OF[wall] || shade(wall, 0.55);

// A rowboat by the water stairs, painted like its owner's house: the wall colour outside, the roof colour
// along the sheer and below the waterline, pale inside. Two thwarts, and a pair of oars shipped along them
// with their blades dipped in the house colour. The bow points along t; returns where the painter is tied.
export function skiff(bld, x, z, t, wall, seed) {
  const F = frame(x, z, t), roof = roofOf(wall);
  const h = hull(bld, F, { L: 0.6, B: 0.12, D: 0.08, T: 0.04, spring: 0.024, rocker: 0.5, transom: 0.62, th: 0.011, stripe: 0.02, floor: 0.022,
    foam: true, bottom: roof, hull: wall, band: roof, rim: '#8f6446', inside: '#efe7d8', boards: '#a77b55' });
  const wood = lin('#9a6b45'), oar = lin('#d2b183'), blade = lin(roof);
  const seat = s => h.top(s) - 0.022;
  for (const s of [0.3, 0.64]) wb(bld, F, h.X(s) - 0.025, h.X(s) + 0.025, -h.w(s) + 0.012, h.w(s) - 0.012, F.y0 + seat(s) - 0.012, F.y0 + seat(s), wood);
  // the oars rest on the forward thwart and over the transom, blades out behind the boat
  const yf = seat(0.64) + 0.008, ya = h.top(0) + 0.008;
  for (const k of [-1, 1]) {
    const z0 = k * 0.03, z1 = k * 0.045;
    rod(bld, at(F, 0.12, yf, z0), at(F, -0.27, ya, z1), 0.006, oar);
    wb(bld, F, -0.335, -0.27, z1 - 0.013, z1 + 0.013, F.y0 + ya - 0.003, F.y0 + ya + 0.004, blade);
  }
  // a coil of line in the bow, or a bailer, whichever the owner left there
  const fwd = h.P(h.X(0.82), seat(0.82) + 0.01, 0);
  if (hash(seed, 1, 0, 132) < 0.5) blob(bld, fwd[0], fwd[1], fwd[2], 0.032, 0.01, 0.032, '#c8b48a');
  else { const b = h.P(h.X(0.18), h.top(0.18) - 0.05, 0.03); boxAt(bld, b[0], b[2], 0.018, b[1], b[1] + 0.03, lin(PALETTE[Math.floor(hash(seed, 2, 0, 132) * PALETTE.length)].wall)); }
  return h.P(h.X(1) - 0.012, h.top(1) - 0.01, 0);
}

// A boathouse keeps its owner's launch out of the weather: a varnished hull with the house colour along
// the sheer, under a laced canvas cover, and an outboard motor tilted up out of the water on the transom.
const CANVAS = ['#e3d3b4', '#b9cdd6', '#c9d6b6', '#e6c9b8'];
export function launch(bld, x, z, t, wall, seed) {
  const F = frame(x, z, t);
  const h = hull(bld, F, { L: 0.68, B: 0.135, D: 0.085, T: 0.045, spring: 0.018, rocker: 0.45, transom: 0.6, th: 0.012, stripe: 0.024, floor: 0.022,
    foam: true, bottom: '#5b4a40', hull: '#b78557', band: wall, rim: '#7a5440', inside: '#a77b55', boards: '#8f6446' });
  const canvas = lin(CANVAS[Math.floor(hash(seed, 1, 0, 133) * CANVAS.length)]), s0 = 0.03, s1 = 0.84, n = 6;
  const edge = (s, k) => h.P(h.X(s), h.top(s) + 0.004, k * (h.w(s) + 0.006)), ridge = s => h.P(h.X(s), h.top(s) + 0.05, 0);
  for (let i = 0; i < n; i++) {
    const a = s0 + (s1 - s0) * i / n, b = s0 + (s1 - s0) * (i + 1) / n, below = h.P(h.X((a + b) / 2), -0.2, 0);
    for (const k of [-1, 1]) face(bld, 'main', [edge(a, k), edge(b, k), ridge(b), ridge(a)], canvas, below);
  }
  face(bld, 'main', [edge(s0, 1), edge(s0, -1), ridge(s0)], canvas, h.P(h.X(s0) + 1, 0, 0));
  face(bld, 'main', [edge(s1, 1), edge(s1, -1), ridge(s1)], canvas, h.P(h.X(s1) - 1, 0, 0));
  const lace = lin('#7d6a55');
  for (const s of [0.24, 0.46, 0.68]) {
    const r = ridge(s), up = [r[0], r[1] + 0.004, r[2]];
    for (const k of [-1, 1]) rod(bld, edge(s, k).map((c, i) => c + (i === 1 ? 0.002 : 0)), up, 0.004, lace);
  }
  // the outboard: a cream cowling on the transom, its leg swung up behind the boat
  const tr = h.X(0), cy = h.top(0);
  wb(bld, F, tr - 0.06, tr - 0.005, -0.024, 0.024, F.y0 + cy - 0.005, F.y0 + cy + 0.045, lin('#efe4cf'));
  wb(bld, F, tr - 0.062, tr - 0.003, -0.026, 0.026, F.y0 + cy + 0.045, F.y0 + cy + 0.055, lin('#c95f3c'));
  rod(bld, h.P(tr - 0.04, cy, 0), h.P(tr - 0.15, cy + 0.005, 0), 0.008, lin('#4a5058'));
  boxAt(bld, h.P(tr - 0.155, 0, 0)[0], h.P(tr - 0.155, 0, 0)[2], 0.014, F.y0 + cy - 0.01, F.y0 + cy + 0.02, lin('#4a5058'));
}

// A gozzo, the double-ended fishing boat of Mediterranean harbours: a high stem and sternpost, an eye painted
// on each bow to see the way home, a short mast with a lantern for fishing at night, nets and crates aboard,
// fenders over the side toward the quay (`quay` is -1 or 1, the side of the boat the quay is on). Returns the
// tops of the stem and sternpost, where the mooring lines are made fast.
export function fishingBoat(bld, x, z, t, quay, seed) {
  const F = frame(x, z, t), r = k => hash(seed[0], seed[1], k, 131);
  const main = PALETTE[Math.floor(r(1) * PALETTE.length)];
  const second = PALETTE[(PALETTE.indexOf(main) + 1 + Math.floor(r(2) * (PALETTE.length - 1))) % PALETTE.length];
  const h = hull(bld, F, { L: 0.9, B: 0.17, D: 0.1, T: 0.065, spring: 0.03, stem: 0.035, rocker: 0.45, th: 0.014, stripe: 0.042, floor: 0.026,
    foam: true, bottom: main.roof, hull: main.wall, band: second.wall, rim: main.roof, inside: '#efe7d8', boards: '#8f6446' });
  const band = lin(second.wall), cap = lin(main.roof), wood = lin('#8f6446'), rope = lin('#c8b48a');
  const post = s => { const x0 = h.X(s) + (s ? -0.014 : 0.014), y1 = h.top(s) + 0.07;
    wb(bld, F, x0 - 0.012, x0 + 0.012, -0.009, 0.009, F.y0 + h.top(s) - 0.03, F.y0 + y1, band);
    wb(bld, F, x0 - 0.014, x0 + 0.014, -0.011, 0.011, F.y0 + y1, F.y0 + y1 + 0.012, cap);
    return h.P(x0, y1 + 0.006, 0); };
  const ends = [post(0), post(1)];
  for (const k of [-1, 1]) {
    onSide(bld, h, F, 0.85, k, 0.58, 0.055, 0.32, 0.004, lin(C.trim));
    onSide(bld, h, F, 0.855, k, 0.58, 0.022, 0.24, 0.007, lin('#2e3a48'));
  }
  // thwart and mast step amidships forward, the lantern hung a little below the masthead
  const ms = 0.64, mx = h.X(ms), mp = h.P(mx, 0, 0), mt = h.top(ms) + 0.4;
  wb(bld, F, mx - 0.03, mx + 0.03, -h.w(ms) + 0.014, h.w(ms) - 0.014, F.y0 + h.top(ms) - 0.03, F.y0 + h.top(ms) - 0.016, wood);
  boxAt(bld, mp[0], mp[2], 0.01, F.y0 + 0.026, F.y0 + mt, wood);
  const lp = h.P(mx + 0.03, 0, 0), ly = F.y0 + mt - 0.1;
  rod(bld, [mp[0], ly + 0.07, mp[2]], [lp[0], ly + 0.07, lp[2]], 0.005, lin('#4a5058'));
  boxAt(bld, lp[0], lp[2], 0.022, ly, ly + 0.055, lin(C.lamp), 'lit');
  boxAt(bld, lp[0], lp[2], 0.028, ly + 0.055, ly + 0.07, lin('#4a5058'));
  for (const e of ends) rod(bld, [mp[0], F.y0 + mt - 0.01, mp[2]], e, 0.003, rope);
  // nets heaped aft with cork floats on them, crates stacked by the mast
  const NETS = ['#d9775a', '#5f8f8a', '#e9b872', '#4f6d8a'], net = NETS[Math.floor(r(3) * NETS.length)];
  const np = h.P(h.X(0.26), 0.026, 0.01);
  blob(bld, np[0], np[1] + 0.02, np[2], 0.085, 0.032, 0.07, net, F);
  blob(bld, np[0] + F.t[0] * 0.06, np[1] + 0.045, np[2] + F.t[1] * 0.06, 0.05, 0.022, 0.045, shade(net, 0.9), F);
  for (let i = 0; i < 4; i++) { const c = h.P(h.X(0.2 + i * 0.05), 0.075 + (i & 1) * 0.01, (i & 1 ? -0.03 : 0.035)); blob(bld, c[0], c[1], c[2], 0.012, 0.009, 0.012, C.gold); }
  const crate = (s, zc, y0, col) => wb(bld, F, h.X(s) - 0.035, h.X(s) + 0.035, zc - 0.03, zc + 0.03, F.y0 + y0, F.y0 + y0 + 0.04, lin(col));
  crate(0.47, -0.04, 0.026, '#9a6b45');
  crate(0.47, 0.035, 0.026, PALETTE[Math.floor(r(4) * PALETTE.length)].wall);
  if (r(5) < 0.6) crate(0.47, -0.035, 0.068, '#b78557');
  // fenders hang over the quay side on short lines, where the hull would rub the stone
  for (const s of [0.34, 0.62]) {
    const o = h.P(h.X(s), h.top(s) - 0.055, quay * (h.w(s) + 0.022));
    blob(bld, o[0], o[1], o[2], 0.02, 0.032, 0.02, C.trim);
    rod(bld, [o[0], o[1] + 0.03, o[2]], h.P(h.X(s) + 0.002, h.top(s) + 0.004, quay * (h.w(s) - 0.004)), 0.003, rope);
  }
  return ends;
}

// Sailing boats out in the bay, each rigged its own way, drawn at the origin with the bow along +x and the
// waterline at y = 0, so the boat can be moved as a whole. Sails fill to +z; heel the boat that way.
export const RIGS = {
  // a beamy catboat with one gaff sail, the mast right up in the bow
  cat: { hull: { L: 0.95, B: 0.22, D: 0.09, T: 0.07, transom: 0.66, spring: 0.02 }, paint: PALETTE[0], band: PALETTE[0].roof, sail: '#f6eedf', flag: PALETTE[2].wall },
  // a sloop: a tall mainsail with a coloured band and a jib to the stemhead
  sloop: { hull: { L: 1.05, B: 0.19, D: 0.085, T: 0.07, transom: 0.5, spring: 0.024 }, paint: PALETTE[6], band: PALETTE[4].wall, sail: '#fbf8f2', flag: PALETTE[0].wall },
  // a double-ended felucca with a lateen sail on a long slanting yard
  lateen: { hull: { L: 1.0, B: 0.18, D: 0.09, T: 0.065, stem: 0.06, spring: 0.03 }, paint: PALETTE[3], band: PALETTE[2].wall, sail: '#e9b872', flag: PALETTE[5].wall },
};
export function sailboat(bld, name) {
  const R = RIGS[name], F = frame(0, 0, [1, 0], 0);
  const h = hull(bld, F, { ...R.hull, rocker: 0.45, th: 0.014, stripe: 0.026, floor: 0.025, bottom: R.paint.roof, hull: R.paint.wall, band: R.band,
    rim: '#8f6446', inside: '#efe7d8', boards: '#a77b55' });
  const wood = lin('#8f6446'), spar = lin('#b78557'), sailC = lin(R.sail), rope = lin('#c8b48a');
  // a sail between a luff and a leech, in rows that belly out to leeward
  const sail = (luff, leech, col, rows = 4, cols = 3, belly = 0.045, colOf = () => col) => {
    const pt = (r, c) => { const l = lerp3(luff[0], luff[1], r / rows), e = lerp3(leech[0], leech[1], r / rows), p = lerp3(l, e, c / cols);
      p[2] += belly * Math.sin(Math.PI * c / cols) * (1 - 0.6 * r / rows); return p; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) both(bld, [pt(r, c), pt(r, c + 1), pt(r + 1, c + 1), pt(r + 1, c)], colOf(r));
  };
  // swing a point about the mast to leeward, the way the boom lies when sailing across the wind
  const swing = (mx, p, a = 0.4) => [mx + (p[0] - mx) * Math.cos(a), p[1], p[2] - (p[0] - mx) * Math.sin(a)];
  const flag = (x, y, col) => both(bld, [[x, y, 0], [x, y - 0.05, 0], [x - 0.13, y - 0.03, 0.02]], lin(col));
  let mx, my;
  if (name === 'cat') {
    mx = h.X(0.86); my = h.top(0.86) + 0.8;
    const tack = [mx - 0.012, h.top(0.86) + 0.06, 0], throat = [mx - 0.012, my - 0.18, 0];
    const peak = swing(mx, [mx - 0.5, my + 0.02, 0]), clew = swing(mx, [h.X(0.04), h.top(0) + 0.08, 0]);
    sail([tack, throat], [clew, peak], sailC);
    rod(bld, throat, peak, 0.007, spar); rod(bld, tack, clew, 0.008, spar);
  } else if (name === 'sloop') {
    mx = h.X(0.62); my = h.top(0.62) + 0.98;
    const tack = [mx - 0.012, h.top(0.62) + 0.07, 0], head = [mx - 0.012, my - 0.02, 0], clew = swing(mx, [h.X(0.05), h.top(0) + 0.1, 0]);
    sail([tack, head], [clew, head], sailC, 5, 3, 0.05, r => (r === 1 ? lin(R.band) : sailC));
    rod(bld, tack, clew, 0.008, spar);
    const jt = [h.X(1) - 0.02, h.top(1) + 0.02, 0], jh = [mx + 0.01, my - 0.2, 0], jc = swing(mx, [mx - 0.14, h.top(0.5) + 0.07, 0.0], 0.55);
    sail([jt, jh], [jc, jh], sailC, 4, 2, 0.04);
  } else {
    mx = h.X(0.68); my = h.top(0.68) + 0.42;
    const lo = swing(mx, [h.X(1.02), h.top(1) + 0.05, 0], 0.25), hi = swing(mx, [h.X(0.0) - 0.08, my + 0.5, 0], 0.25);
    const clew = swing(mx, [h.X(0.06), h.top(0) + 0.1, 0], 0.45);
    sail([lo, hi], [clew, hi], sailC, 5, 3, 0.05);
    rod(bld, lo, hi, 0.008, spar);
    rod(bld, [mx, my, 0], lerp3(lo, hi, 0.42), 0.004, rope);
  }
  wb(bld, F, mx - 0.012, mx + 0.012, -0.012, 0.012, 0.025, my, wood);
  flag(mx, my + 0.06, R.flag);
  wb(bld, F, mx - 0.004, mx + 0.004, -0.004, 0.004, my, my + 0.065, wood);
  // a forestay to the bow, a thwart for the crew, and a lantern on the stern for coming home after dark
  rod(bld, [mx, my - 0.01, 0], [h.X(1) - 0.01, h.top(1) + 0.02, 0], 0.003, rope);
  wb(bld, F, h.X(0.45) - 0.03, h.X(0.45) + 0.03, -h.w(0.45) + 0.014, h.w(0.45) - 0.014, h.top(0.45) - 0.034, h.top(0.45) - 0.02, wood);
  const sx = h.X(0) + 0.04;
  boxAt(bld, sx, 0, 0.016, h.top(0) + 0.03, h.top(0) + 0.07, lin(C.lamp), 'lit');
  boxAt(bld, sx, 0, 0.02, h.top(0) + 0.07, h.top(0) + 0.082, lin('#4a5058'));
  boxAt(bld, sx, 0, 0.006, h.top(0) - 0.01, h.top(0) + 0.03, lin('#4a5058'));
  // a rudder hung on the transom with its tiller over the stern; the felucca steers with an oar
  if (name !== 'lateen') {
    wb(bld, F, h.X(0) - 0.04, h.X(0) - 0.002, -0.006, 0.006, -0.06, h.top(0) + 0.015, lin(R.band));
    rod(bld, [h.X(0) - 0.03, h.top(0) + 0.01, 0], [h.X(0) + 0.16, h.top(0) + 0.03, 0.01], 0.006, wood);
  } else rod(bld, [h.X(0.12), h.top(0.12) + 0.01, 0.06], [h.X(0) - 0.2, -0.02, 0.1], 0.007, spar);
  return h;
}
