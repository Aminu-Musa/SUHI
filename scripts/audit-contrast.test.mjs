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
    /* The two task-12 wash rows are excluded alongside the `--accent-fill` one: this test is
     * about the DECLARED grounds being covered exhaustively, and the wash is not one. Its own
     * describe block below counts it. */
    const text = auditPairs().filter((r) => !r.use.includes('--accent-fill') && !r.use.includes('--accent-wash'));
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

/* TASK 12. The audit's 80 rows were all green while four Compare pickers rendered accent text
 * at 3.17:1 in Modernist, because the audit only knows DECLARED grounds and `.pk[aria-pressed=
 * true]` paints its own: the page washed with 12% accent. The wash is now audited for the one
 * token that sits on it, so the gap cannot reopen quietly - a row, not a comment. */
describe('the accent wash ground (task 12)', () => {
  it('audits --accent-ink on the 12% accent wash, in both themes', () => {
    const rows = auditPairs().filter((r) => r.use.endsWith('@--accent-wash'));
    expect(rows).toHaveLength(THEMES.length);
    for (const row of rows) {
      expect(row.use).toMatch(/^(nocturne|modernist)\/--accent-ink@--accent-wash$/);
      expect(row.pass, `${row.use} is ${row.ratio.toFixed(2)}:1`).toBe(true);
    }
  });

  it('catches the fill token put back where the ink token goes - the actual defect', () => {
    /* The shipped page had `color:var(--color-accent)` on `.pk[aria-pressed=true]`. This is
     * that state, measured: without the row above, the audit says nothing about it. */
    const rows = auditPairs({ overrides: { 'modernist/--accent-ink': '#ec3013' } });
    const row = rows.find((r) => r.use === 'modernist/--accent-ink@--accent-wash');
    expect(row.pass).toBe(false);
    expect(row.ratio).toBeLessThan(3.2);
  });

  it('takes the row count to 82, and every one of them passes', () => {
    const rows = auditPairs();
    expect(rows).toHaveLength(82); // 78 ink-on-ground + 2 white-on-accent-fill + 2 accent-ink-on-wash
    expect(rows.filter((r) => !r.pass)).toEqual([]);
  });

  it('audits the wash for --accent-ink ONLY, because no other text token meets one', () => {
    /* `--ui-muted` is the near miss and the reason this is asserted rather than assumed: it is
     * the `.pk` colour in the UNSELECTED state, where `background:none` leaves the ground the
     * plain page - the wash arrives with `aria-pressed=true`, and so does the accent. Audited
     * on the wash, `--ui-muted` would read 4.93 Modernist / 5.16 Nocturne and pass, but it
     * would be a row about a pairing the stylesheet never paints, and `--ui-muted` is an
     * AUTHORED token (§4): a row that failed could not be fixed by re-deriving anything. */
    const wash = auditPairs().filter((r) => r.use.endsWith('@--accent-wash'));
    expect(new Set(wash.map((r) => r.use.split('@')[0].split('/')[1]))).toEqual(new Set(['--accent-ink']));
  });
});
