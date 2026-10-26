import { describe, expect, it } from 'vitest';
import { runScene } from '../fixtures/driver.js';
import { SCENES } from '../fixtures/scenes.js';
import { findCoplanar, opaqueTriangles } from '../src/geom/overlap.js';

// Faces that share a plane, face the same way and look different flicker on screen (z-fighting). Before
// the systemic fixes about 14% of the default town's triangles were tied; now about 0.4%, most of it
// overlapping ivy leaves. This keeps it from creeping back: new geometry must not author details at
// exactly the same depth as what they sit on (see `band`, the box skin in `wb`, `jointHalf`).
const MAX_SHARE = 0.006;

describe('tied faces (z-fighting)', () => {
  for (const name of ['townA', 'houseTypes']) {
    it(`${name} keeps visible ties under ${MAX_SHARE * 100}% of its triangles`, () => {
      const { town } = runScene(SCENES[name]), { tris, labels, looks } = opaqueTriangles(town);
      const ties = findCoplanar(tris, labels, looks), share = ties.length / (tris.length / 9);
      expect(share).toBeLessThan(MAX_SHARE);
    });
  }
});
