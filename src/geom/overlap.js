// ---------- coplanar faces ----------
// Two faces that lie in the same plane, face the same way and overlap are drawn at the same depth, and the
// GPU picks between them differently from frame to frame and pixel to pixel: z-fighting, the flicker on
// walls, sills and window frames. Precision can't fix a true tie, so this finds every one in the emitted
// geometry. Faces count as tied when their planes are under GAP apart (0.2 mm: closer than the depth buffer
// can separate even at the farthest framing) and they overlap by more than AREA.
const GAP = 0.0002, AREA = 2e-5;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// area of the overlap of two convex 2D polygons (Sutherland-Hodgman clipping)
function clipArea(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inp = out;
    out = [];
    const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  let s = 0;
  for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(s) / 2;
}

// tris: a flat array of positions (9 numbers per triangle) with a parallel list of labels (bucket names or
// source lines), and looks: one string per triangle for what it shows (colour and painted surface). Two
// tied faces that look the same can't visibly flicker (either one wins, the pixel is the same), so only
// ties between faces that look different are returned: where, which labels, how far apart, how much overlap.
export function findCoplanar(tris, labels, looks) {
  const groups = new Map(), T = [];
  for (let t = 0; t < tris.length / 9; t++) {
    const a = [tris[t * 9], tris[t * 9 + 1], tris[t * 9 + 2]], b = [tris[t * 9 + 3], tris[t * 9 + 4], tris[t * 9 + 5]], c = [tris[t * 9 + 6], tris[t * 9 + 7], tris[t * 9 + 8]];
    const n = cross(sub(b, a), sub(c, a)), len = Math.hypot(...n);
    if (len < 1e-9) continue;
    n[0] /= len; n[1] /= len; n[2] /= len;
    const d = dot(n, a);
    T.push({ t, a, b, c, n, d, label: labels[t], look: looks ? looks[t] : '' });
    // bucket by orientation and plane offset; neighbours in offset are checked too
    const key = Math.round(n[0] * 200) + ',' + Math.round(n[1] * 200) + ',' + Math.round(n[2] * 200);
    const k = key + '|' + Math.floor(d / GAP);
    (groups.get(k) || groups.set(k, []).get(k)).push(T.length - 1);
  }
  const ties = [];
  const seen = new Set();
  for (const [k, list] of groups) {
    const [key, slot] = k.split('|'), next = groups.get(key + '|' + (+slot + 1)) || [];
    const all = list.concat(next);
    if (all.length < 2) continue;
    // a coarse 2D grid over the group keeps big coplanar areas (a street, a long wall) cheap
    const { n } = T[all[0]], u = Math.abs(n[1]) < 0.9 ? cross([0, 1, 0], n) : cross([1, 0, 0], n), ul = Math.hypot(...u);
    const U = [u[0] / ul, u[1] / ul, u[2] / ul], V = cross(n, U);
    const flat = i => [T[i].a, T[i].b, T[i].c].map(p => [dot(p, U), dot(p, V)]);
    const grid = new Map();
    for (const i of all) {
      const P = flat(i), xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / 0.25); gx <= Math.floor(Math.max(...xs) / 0.25); gx++) {
        for (let gy = Math.floor(Math.min(...ys) / 0.25); gy <= Math.floor(Math.max(...ys) / 0.25); gy++) {
          const g = gx + ',' + gy;
          (grid.get(g) || grid.set(g, []).get(g)).push(i);
        }
      }
    }
    for (const cell of grid.values()) {
      for (let x = 0; x < cell.length; x++) for (let y = x + 1; y < cell.length; y++) {
        const i = cell[x], j = cell[y], A = T[i], B = T[j];
        if (A.look === B.look || dot(A.n, B.n) < 0.999 || Math.abs(A.d - B.d) >= GAP) continue;
        const pair = i < j ? i + ':' + j : j + ':' + i;
        if (seen.has(pair)) continue;
        seen.add(pair);
        let PA = flat(i), PB = flat(j);
        // both triangles counter-clockwise for the clipper
        const ccw = P => ((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0])) < 0 ? P.slice().reverse() : P;
        PA = ccw(PA); PB = ccw(PB);
        const area = clipArea(PA, PB);
        if (area > AREA) ties.push({ at: A.a.map(v => +v.toFixed(3)), labels: [A.label, B.label], gap: +Math.abs(A.d - B.d).toFixed(5), area: +area.toFixed(5) });
      }
    }
  }
  return ties;
}

// every opaque triangle of an emitted town, labelled by bucket, ready for findCoplanar
export function opaqueTriangles(town) {
  const tris = [], labels = [], looks = [];
  for (const m of [...town.chunks.values(), ...town.courtyards.values()]) {
    for (const name of ['main', 'lit', 'dark']) {
      const { p, c, k } = m[name];
      for (let i = 0; i < p.length; i++) tris.push(p[i]);
      // a triangle's look: its bucket, painted kind and average colour, coarsely rounded
      for (let i = 0; i < p.length / 9; i++) {
        let r = 0, g = 0, b = 0;
        for (let j = 0; j < 3; j++) { r += c[i * 9 + j * 3]; g += c[i * 9 + j * 3 + 1]; b += c[i * 9 + j * 3 + 2]; }
        looks.push(name + k[i * 3] + ':' + Math.round(r * 20) + ',' + Math.round(g * 20) + ',' + Math.round(b * 20));
      }
      for (let i = 0; i < p.length / 9; i++) labels.push(m[name].src ? m[name].src[i] : name);
    }
  }
  return { tris, labels, looks };
}
