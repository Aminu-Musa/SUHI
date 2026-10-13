import { describe, it, expect } from 'vitest';
import { THEME_TOKENS } from './lib/tokens.mjs';
import { auditPairs } from './audit-contrast.mjs';

describe('auditPairs', () => {
  it('passes every text pair at its floor', () => {
    const failures = auditPairs().filter((p) => !p.pass);
    expect(failures).toEqual([]);
  });

  it('pins the ratios the spec publishes', () => {
    const byUse = Object.fromEntries(auditPairs().map((p) => [p.use, p.ratio]));
    expect(byUse['nocturne/--cold-ink@--surface-2']).toBeCloseTo(8.28, 1);
    expect(byUse['nocturne/--hot-ink@--surface-2']).toBeCloseTo(8.06, 1);
    expect(byUse['modernist/--hot-ink@--surface-2']).toBeCloseTo(4.7, 1);
    expect(byUse['modernist/--accent@--surface-2']).toBeCloseTo(4.5, 1);
    expect(byUse['nocturne/--on-accent']).toBeCloseTo(8.33, 1);
  });

  it('audits every text token on all three grounds', () => {
    const rows = auditPairs().filter((p) => p.floor === 4.5 && !p.use.includes('--on-accent'));
    expect(rows).toHaveLength(Object.keys(THEME_TOKENS).length * 5 * 3);
    expect(new Set(rows.map((p) => p.use.split('@')[1]))).toEqual(new Set(['--bg', '--surface', '--surface-2']));
  });

  it('reports pass:false when a pair regresses', () => {
    expect(
      auditPairs({ overrides: { 'nocturne/--cold-ink': '#3467ad' } }).find(
        (p) => p.use === 'nocturne/--cold-ink@--bg',
      ).pass,
    ).toBe(false);
  });
});
