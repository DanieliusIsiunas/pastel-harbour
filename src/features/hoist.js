import { topOf } from '../core/model.js';
import { C } from '../core/palette.js';
import { lin, shade } from '../core/util.js';
import { boxAt, rod, wb } from '../geom/builder.js';

// a warehouse's loading door with a hoist beam, a rope and a hanging crate
export default {
  kind: 'hoist', slot: 'side', phase: 'front',
  rule: { at: (v, y) => y >= 2 && y === topOf(v), ctx: c => c === 'over-street' || c === 'over-water', types: ['warehouse'],
    max: () => 1, p: () => 0.85, why: 'a loading door and hoist beam above the street or water' },
  draw(bld, { F, y, L, s, cell }) {
    if (L <= 0.25) return false;
    const wood = lin(C.wood), dark = lin(shade(C.wood, 0.7));
    bld.open.push([-0.01, 0.22, y - 0.1, y + 1]);
    wb(bld, F, 0, 0.19, 0, 0.025, y + 0.04, y + 0.82, lin(C.trim));
    for (let i = 0; i < 3; i++) wb(bld, F, i * 0.05, i * 0.05 + 0.048, 0, 0.036, y + 0.06, y + 0.78, i & 1 ? wood : lin(shade(C.wood, 1.12)));
    wb(bld, F, 0, 0.16, 0.036, 0.046, y + 0.4, y + 0.44, dark);
    if (cell.i < cell.nb[s.k]) {
      // the beam is drawn once, by one half of the joint
      wb(bld, F, -0.025, 0.025, -0.05, 0.42, y + 0.9, y + 0.96, dark);
      wb(bld, F, -0.03, 0.03, 0.36, 0.42, y + 0.84, y + 0.9, lin('#3b4148'));
      const rx = F.a[0] + F.n[0] * 0.39, rz = F.a[1] + F.n[1] * 0.39;
      rod(bld, [rx, y + 0.84, rz], [rx, y + 0.42, rz], 0.005, lin('#c8b48a'));
      boxAt(bld, rx, rz, 0.07, y + 0.27, y + 0.42, lin('#c9a273'));
      boxAt(bld, rx, rz, 0.072, y + 0.33, y + 0.35, lin(shade('#c9a273', 0.8)));
    }
    return true;
  },
};
