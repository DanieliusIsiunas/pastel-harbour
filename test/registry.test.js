import { describe, expect, it } from 'vitest';
import { FEATURES, feature, rulesFor } from '../src/features/index.js';

// The feature registry is the contract between the planner and the geometry: every module must say
// where it goes, why, and how to draw itself.
const SLOTS = ['side', 'overlay', 'node', 'edge', 'boathouse'];

describe('feature registry', () => {
  it('has unique kinds and aliases', () => {
    const names = FEATURES.flatMap(f => [f.kind, ...(f.aliases || [])]);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(feature.get(n)).toBeTruthy();
  });
  for (const f of FEATURES) {
    it(`${f.kind} is a complete feature module`, () => {
      expect(SLOTS).toContain(f.slot);
      expect(typeof f.draw).toBe('function');
      expect(typeof f.rule.why).toBe('string');
      expect(f.rule.why.length).toBeGreaterThan(8);
      if (f.slot === 'side') {
        expect(['entry', 'front', 'window']).toContain(f.phase);
        for (const k of ['at', 'ctx', 'max', 'p']) expect(typeof f.rule[k]).toBe('function');
      }
      if (f.slot === 'overlay') for (const k of ['at', 'ctx', 'max', 'p']) expect(typeof f.rule[k]).toBe('function');
      if (f.slot === 'node') { expect(typeof f.rule.ctx).toBe('function'); expect(f.rule.spacing).toBeGreaterThan(0); expect(f.rule.p).toBeGreaterThan(0); }
      if (f.slot === 'edge') { expect(f.rule.spacing).toBeGreaterThan(0); expect(f.rule.p).toBeGreaterThan(0); }
    });
  }
  it('hands the planner its rules in registry order', () => {
    expect(rulesFor('side').map(r => r.kind)).toEqual(FEATURES.filter(f => f.slot === 'side').map(f => f.kind));
  });
});
