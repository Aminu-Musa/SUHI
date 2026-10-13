import { describe, it, expect } from 'vitest';
import { auditPairs } from './audit-contrast.mjs';

describe('auditPairs', () => {
  it('passes every text pair at its floor', () => {
    const failures = auditPairs().filter((p) => !p.pass);
    expect(failures).toEqual([]);
  });

  it('pins the ratios the spec publishes', () => {
    const byUse = Object.fromEntries(auditPairs().map((p) => [p.use, p.ratio]));
    expect(byUse['nocturne/--cold-ink']).toBeCloseTo(8.28, 1);
    expect(byUse['nocturne/--hot-ink']).toBeCloseTo(8.06, 1);
    expect(byUse['modernist/--hot-ink']).toBeCloseTo(4.7, 1);
    expect(byUse['modernist/--accent']).toBeCloseTo(4.5, 1);
    expect(byUse['nocturne/--on-accent']).toBeCloseTo(8.33, 1);
  });

  it('reports pass:false when a pair regresses', () => {
    expect(
      auditPairs({ overrides: { 'nocturne/--cold-ink': '#3467ad' } }).find(
        (p) => p.use === 'nocturne/--cold-ink',
      ).pass,
    ).toBe(false);
  });
});
