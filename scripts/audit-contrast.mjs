/**
 * Build-time WCAG 2.1 AA audit of every text pair the dashboard renders (spec §5, §9.2).
 *
 * Retargeted for the pixel rebuild: the ramps are authored fills, not a generated palette,
 * and ramp-coloured TEXT uses the derived -ink scale instead. So the audit measures
 *   - `--color-text`, `--ui-muted`, `--accent-ink` and all ten ramp `-ink` steps,
 *     on each of the three grounds that carry text, in both themes (78 rows), and
 *   - white ON `--accent-fill`, the one pair where the fill moved instead of the text.
 *
 * Every row has the same 4.5 floor. The 3.0 large-text allowance applies to exactly one
 * pair (`.kpi .val`, 24px) and is not needed: the ink scale clears 4.5 everywhere, so no
 * row is exempted. `--color-accent` is deliberately NOT a text token any more.
 *
 * Exits 1 on any failure.
 *
 * ROW IDS. Text rows are `theme/--token@--ground`, as brief Step 7 and spec §9.2 state.
 * The one reverse-direction row is `theme/#ffffff@--accent-fill`: the foreground there is
 * literal white, which is not declared as a token in either theme block, so the first slot
 * holds the hex rather than a token name. The id is still `theme/<fg>@<bg>` — a downstream
 * parser should read the slots as foreground and background, and expect the foreground slot
 * to be a hex on exactly this row. `ON_ACCENT` is exported so callers can build the id
 * rather than hard-coding `#ffffff`, and `audit-contrast.test.mjs` pins both shapes.
 */
import { pathToFileURL } from 'node:url';
import { contrastRatio } from './lib/color.mjs';
import { THEME_TOKENS, THEMES } from './lib/tokens.mjs';
import { INK_TOKENS, TEXT_GROUNDS } from './lib/ink.mjs';

/** The single floor. No row is audited at 3.0; see the module comment. */
export const TEXT_FLOOR = 4.5;

/** Grounds that carry text (spec §5.1). */
export const GROUNDS = TEXT_GROUNDS;

/** Theme-independent text token names, in audit order. */
export const TEXT_TOKENS = Object.freeze([
  '--color-text',
  '--ui-muted',
  '--accent-ink',
  '--hot-1-ink',
  '--hot-2-ink',
  '--hot-3-ink',
  '--hot-4-ink',
  '--hot-5-ink',
  '--cold-1-ink',
  '--cold-2-ink',
  '--cold-3-ink',
  '--cold-4-ink',
  '--cold-5-ink',
]);

/** White, the foreground on `--accent-fill` (spec §5.6). */
export const ON_ACCENT = '#ffffff';

/**
 * Every audited pair, both themes. Text tokens are checked on EVERY ground, so the
 * worst-case pair is found by the audit rather than assumed.
 * `overrides` is a test seam: { 'theme/--token': '#hex' } or { 'theme/--token@--ground': '#hex' }
 * replaces that foreground.
 */
export function auditPairs({ overrides = {} } = {}) {
  const rows = [];
  const add = (use, fg, bg) => {
    const fgHex = overrides[use] ?? overrides[use.split('@')[0]] ?? fg;
    const ratio = contrastRatio(fgHex, bg);
    rows.push({ use, fg: fgHex, bg, ratio, floor: TEXT_FLOOR, pass: ratio >= TEXT_FLOOR });
  };

  for (const theme of THEMES) {
    const tokens = { ...THEME_TOKENS[theme], ...INK_TOKENS(theme) };
    for (const ground of GROUNDS) {
      for (const name of TEXT_TOKENS) {
        const fg = tokens[name];
        if (!fg) throw new Error(`auditPairs: ${theme} has no token ${name}`);
        add(`${theme}/${name}@${ground}`, fg, tokens[ground]);
      }
    }
    // The other direction: white sits on the accent, so the FILL is what moved.
    add(`${theme}/${ON_ACCENT}@--accent-fill`, ON_ACCENT, tokens['--accent-fill']);
  }
  return rows;
}

export function formatTable(rows) {
  const w = Math.max(...rows.map((r) => r.use.length));
  const head = `${'pair'.padEnd(w)}  fg       bg       ratio  floor  result`;
  const lines = rows.map(
    (r) =>
      `${r.use.padEnd(w)}  ${r.fg}  ${r.bg}  ${r.ratio.toFixed(2).padStart(5)}  ${r.floor.toFixed(1).padStart(5)}  ${r.pass ? 'PASS' : 'FAIL'}`,
  );
  return [head, ...lines].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = auditPairs();
  console.log(formatTable(rows));
  const failed = rows.filter((r) => !r.pass);
  console.log(failed.length ? `\n${failed.length} pair(s) FAILED` : `\nAll ${rows.length} pairs pass`);
  process.exit(failed.length ? 1 : 0);
}
