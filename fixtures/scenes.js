// Fixture scenes for regression checks. Each runs in the page through the `harbourDev` console API
// and leaves a deterministic town behind; `harbourDev.digest()` then fingerprints all geometry.
export const SCENES = {
  townA: D => D.sample(20261025),
  townB: D => D.sample(7),
  townC: D => D.sample(424242),
  houseTypes: D => {
    D.clear();
    const area = [];
    for (let v = 0; v < 1200; v++) { const p = D.pos(v); if (p && Math.hypot(p[0], p[1]) < 3.4) area.push(v); }
    const out = area.map(v => [v, 0]);
    const at = (x, z) => D.vertexAt(x, z);
    const col = (v, h, c) => { for (let y = 1; y <= h; y++) out.push([v, y, c]); };
    col(at(-2.0, -1.2), 1, '#f5e6b8');
    col(at(1.8, -1.6), 4, '#c7b3e6');
    const w0 = at(-0.6, 1.8);
    const w1 = D.neighbors(w0).find(n => area.includes(n) && Math.abs(D.pos(n)[1] - 1.8) < 0.8 && D.pos(n)[0] > D.pos(w0)[0]);
    const w2 = D.neighbors(w1).find(n => area.includes(n) && n !== w0 && Math.abs(D.pos(n)[1] - 1.8) < 0.8 && D.pos(n)[0] > D.pos(w1)[0]);
    for (const v of [w0, w1, w2]) col(v, 2, '#9cc5e3');
    const t0 = at(0.4, -0.2), t1 = D.neighbors(t0).find(n => area.includes(n));
    for (const v of [t0, t1]) col(v, 3, '#e8a3a0');
    D.build(out);
  },
  supports: D => {
    D.clear();
    const v0 = D.vertexAt(0, 0), ring = D.neighbors(v0);
    const out = [[v0, 0], [v0, 1, '#e8a3a0'], [v0, 2, '#e8a3a0'], [v0, 3, '#e8a3a0']];
    const n1 = ring[0];
    out.push([n1, 0], [n1, 1, '#a8d5ba'], [n1, 2, '#a8d5ba']);
    const n2 = ring[2], n3 = D.neighbors(n2).find(x => x !== v0 && !ring.includes(x));
    out.push([n2, 3, '#e8a3a0'], [n3, 3, '#e8a3a0']);
    const b = ring[ring.length - 1];
    out.push([b, 1, '#f2d0a4']);
    D.build(out);
  },
};
