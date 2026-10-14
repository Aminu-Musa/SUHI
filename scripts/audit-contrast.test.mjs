import { describe, it, expect } from 'vitest';
import { THEMES } from './lib/tokens.mjs';
import { auditPairs, GROUNDS, TEXT_TOKENS, TEXT_FLOOR, ON_ACCENT } from './audit-contrast.mjs';

describe('auditPairs', () => {
  it('passes every pair at the 4.5 floor', () => {
    expect(auditPairs().filter((r) => !r.pass)).toEqual([]);
  });

  it('audits both themes', () => {
    const rows = auditPairs();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.use).toMatch(/^(nocturne|modernist)\//);
    for (const theme of THEMES) expect(rows.some((r) => r.use.startsWith(`${theme}/`))).toBe(true);
  });

  it('audits every ink token on every text ground', () => {
    const text = auditPairs().filter((r) => !r.use.includes('--accent-fill'));
    expect(text).toHaveLength(THEMES.length * TEXT_TOKENS.length * GROUNDS.length); // 2 x 13 x 3
    expect(text).toHaveLength(78);
    expect(new Set(text.map((r) => r.use.split('@')[1]))).toEqual(new Set(GROUNDS));
    expect(new Set(text.map((r) => r.use.split('@')[0].split('/')[1]))).toEqual(new Set(TEXT_TOKENS));
  });

  it('applies one floor of 4.5 and exempts no row', () => {
    expect(TEXT_FLOOR).toBe(4.5);
    for (const row of auditPairs()) expect(row.floor).toBe(4.5);
  });

  it('fails when any pair is below 4.5', () => {
    // --cold-4's original fill value is 3.09 on the Nocturne map ground: putting it back
    // where the ink token goes must be caught.
    const rows = auditPairs({ overrides: { 'nocturne/--cold-4-ink': '#3467ad' } });
    const row = rows.find((r) => r.use === 'nocturne/--cold-4-ink@--color-bg');
    expect(row.pass).toBe(false);
    expect(rows.filter((r) => !r.pass).length).toBeGreaterThan(0);
  });

  it('white on --accent-fill is audited and passes', () => {
    for (const theme of THEMES) {
      const row = auditPairs().find((r) => r.use === `${theme}/${ON_ACCENT}@--accent-fill`);
      expect(row).toBeDefined();
      expect(row.fg).toBe('#ffffff');
      expect(row.pass).toBe(true);
    }
  });

  it('--color-accent is not audited as a text token', () => {
    // --accent-ink replaced it (spec §5.4). A regression that puts raw accent back into
    // text must fail here rather than ship at 4.38:1.
    expect(TEXT_TOKENS).not.toContain('--color-accent');
    expect(TEXT_TOKENS).toContain('--accent-ink');
    for (const row of auditPairs()) expect(row.use).not.toContain('--color-accent@');
  });

  it('gives every row an id of theme/<fg>@<bg>, with a hex fg slot only on the reverse-direction row', () => {
    // Documented in the audit's header: text rows are theme/--token@--ground; the one row
    // where the fill moved instead of the text carries literal white in the fg slot,
    // because white is not declared as a token in either theme block.
    for (const row of auditPairs()) {
      const [theme, pair] = row.use.split('/');
      expect(THEMES).toContain(theme);
      const [fg, bg] = pair.split('@');
      expect(bg).toMatch(/^--[\w-]+$/);
      if (bg === '--accent-fill') expect(fg).toBe(ON_ACCENT);
      else expect(fg).toMatch(/^--[\w-]+$/);
    }
    expect(auditPairs().filter((r) => !r.use.split('/')[1].startsWith('--'))).toHaveLength(THEMES.length);
  });

  it('pins the ratios spec §5.4 publishes', () => {
    const byUse = Object.fromEntries(auditPairs().map((r) => [r.use, r.ratio]));
    expect(byUse['nocturne/--hot-1-ink@--color-bg']).toBeCloseTo(13.37, 1);
    expect(byUse['nocturne/--cold-4-ink@--ui-panel-2']).toBeCloseTo(4.5, 1);
    expect(byUse['modernist/--hot-1-ink@--color-bg']).toBeCloseTo(5.33, 1);
    expect(byUse['modernist/--cold-5-ink@--ui-tip']).toBeCloseTo(12.64, 1);
    expect(byUse[`nocturne/${ON_ACCENT}@--accent-fill`]).toBeCloseTo(4.51, 1);
    expect(byUse[`modernist/${ON_ACCENT}@--accent-fill`]).toBeCloseTo(4.54, 1);
  });
});
