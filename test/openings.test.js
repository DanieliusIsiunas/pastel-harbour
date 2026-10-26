import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';
import { BRICK_STRIDE, TRACE } from '../src/geom/builder.js';

// Window and door openings must stay clear: no brick, quoin or other wall dressing may reach into one.
// Openings are the stencil masks the window cut-outs are drawn through; each is a quad on the wall plane.
function openings(m) {
  const out = [], p = m.mask.p;
  for (let i = 0; i < p.length; i += 18) {
    const P = [0, 1, 2, 3, 4, 5].map(k => [p[i + k * 3], p[i + k * 3 + 1], p[i + k * 3 + 2]]);
    const xs = P.map(q => q[0]), ys = P.map(q => q[1]), zs = P.map(q => q[2]);
    const a = [Math.min(...xs), Math.min(...zs)], b = [Math.max(...xs), Math.max(...zs)];
    out.push({ a, b, y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  return out;
}
// how far a horizontal span [x0, x1] at height [y0, y1], measured along the opening's wall, reaches into it
function inside(o, s0, s1, y0, y1) {
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
  const ov = Math.min(s1, L) - Math.max(s0, 0), oh = Math.min(y1, o.y1) - Math.max(y0, o.y0);
  return ov > 0.012 && oh > 0.012 ? Math.min(ov, oh) : 0;
}
const along = (o, x, z) => {
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1, t = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
  return { s: (x - o.a[0]) * t[0] + (z - o.a[1]) * t[1], off: Math.abs(-(x - o.a[0]) * t[1] + (z - o.a[1]) * t[0]) };
};

describe('openings stay clear', () => {
  beforeAll(() => { TRACE.on = true; });
  afterAll(() => { TRACE.on = false; });
  for (const name of ['townA', 'townB', 'houseTypes']) {
    it(`${name}: no brick or quoin reaches into a window or door`, () => {
      const { town } = runScene(SCENES[name]), bad = [];
      for (const m of town.chunks.values()) {
        const ops = openings(m);
        if (!ops.length) continue;
        const B = m.bricks.inst;
        for (let i = 0; i < B.length; i += BRICK_STRIDE) {
          const x = B[i], y = B[i + 1], z = B[i + 2], w = B[i + 7], h = B[i + 8];
          for (const o of ops) {
            const { s, off } = along(o, x, z);
            if (off < 0.05 && inside(o, s - w / 2, s + w / 2, y - h / 2, y + h / 2)) bad.push(['brick', x.toFixed(2), y.toFixed(2), z.toFixed(2)]);
          }
        }
        const q = m.main;
        for (let t = 0; t < q.p.length / 9; t++) {
          if (!q.src || !q.src[t].startsWith('emitQuoins')) continue;
          const xs = [q.p[t * 9], q.p[t * 9 + 3], q.p[t * 9 + 6]], ys = [q.p[t * 9 + 1], q.p[t * 9 + 4], q.p[t * 9 + 7]], zs = [q.p[t * 9 + 2], q.p[t * 9 + 5], q.p[t * 9 + 8]];
          for (const o of ops) {
            const ss = xs.map((x, k) => along(o, x, zs[k]));
            if (Math.max(...ss.map(e => e.off)) < 0.06 && inside(o, Math.min(...ss.map(e => e.s)), Math.max(...ss.map(e => e.s)), Math.min(...ys), Math.max(...ys))) bad.push(['quoin', xs[0].toFixed(2), ys[0].toFixed(2), zs[0].toFixed(2)]);
          }
        }
      }
      expect(bad.length, JSON.stringify(bad.slice(0, 5))).toBe(0);
    });
  }
});
