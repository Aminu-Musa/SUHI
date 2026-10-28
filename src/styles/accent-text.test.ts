// @vitest-environment node
/* TASK 12 — the stylesheet's own accent text, which §5.2's inventory never reached.
 *
 * Spec §3's second table sanctions exactly one change to text colour: "a parallel `*-ink` scale
 * for EVERY text usage". §5.2 then lists the usages - and it says where its list came from:
 * "Verified against the prototype's render functions, not inferred from the stylesheet". The
 * components were moved to the ink scale accordingly (Compare's cluster note, the Table's
 * cluster column, the Tooltip note, the Drawer pill). The STYLESHEET's own accent text was
 * never inventoried, so it kept the fill token, and `scripts/audit-contrast.mjs` - whose module
 * comment states "`--color-accent` is deliberately NOT a text token any more" - was measuring
 * tokens rather than usages and could not see the contradiction.
 *
 * What that cost, measured on the built page by tests/a11y.spec.ts: `.pk[aria-pressed=true]`,
 * the selected Compare pickers, at 3.17:1 in Modernist. Four of them, on the default view of
 * the Compare tab, while the audit reported 80 of 80 green.
 *
 * This file is the guard that stops it reopening. It reads the shipped CSS, so a declaration
 * added tomorrow is caught by the same rule rather than by someone remembering.
 */
import { describe, expect, test } from 'vitest';
/* `?raw`, as print.test.ts reads its four stylesheets - `node:fs` has no types in this
 * tsconfig, and the whole point of reading the SHIPPED text is to read what Vite ships. The
 * first test below is the counterweight: `?raw` is exactly what returned an empty string for
 * 18,087 characters of CSS once (see the README), so the length is asserted before anything
 * is concluded from the contents. */
import rawCss from './app.css?raw';

const APP_CSS = rawCss;

/** Every `color:` declaration in the file, with the selector block it belongs to. */
function colorDeclarations(css: string): { selector: string; value: string }[] {
  const out: { selector: string; value: string }[] = [];
  /* Comments first: app.css carries long prose blocks that quote declarations, and a quoted
   * `color:var(--color-accent)` in a note about why something moved would otherwise fail the
   * test the note is explaining. */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim().replace(/\s+/g, ' ');
    for (const decl of block[2].matchAll(/(?:^|;)\s*color\s*:\s*([^;]+)/g)) {
      out.push({ selector, value: decl[1].trim() });
    }
  }
  return out;
}

/* The one declaration left on the fill token, with the reason it is left.
 *
 * `a{color:var(--color-accent)}` paints NO rendered link on this page. The only anchors the
 * app produces are MapLibre's attribution credits, and `.maplibregl-ctrl-attrib a` (0,1,1)
 * outranks a bare `a` (0,0,1), so MapLibre's own colour wins - which is why axe reports no link
 * violation while `--color-accent` on `--color-bg` is 3.76:1 in Modernist.
 *
 * It is NOT moved to `--accent-ink` because its hover partner cannot follow: `a:hover` uses
 * `--color-accent-600`, which has no `-ink` sibling and measures 3.95 / 4.25 on `--color-bg` as
 * text. Moving the rest and leaving hover behind would give this page one link colour that is
 * audited and one that is not, which is worse than leaving a dead rule as the original wrote
 * it. Deriving `--color-accent-600-ink` is a §5 extension - a new token in the authored block -
 * and that is the user's call, not this task's.
 */
const SANCTIONED_FILL_AS_TEXT = new Map([
  ['a', 'no rendered link uses it; a:hover has no ink sibling — see the note above'],
  ['a:hover', '--color-accent-600 has no -ink sibling; 3.95 / 4.25 on --color-bg as text'],
]);

describe('accent text uses the ink scale (spec §3, §5.2)', () => {
  test('the stylesheet was actually READ, so every assertion below is about something', () => {
    /* The README's first lesson, applied here: a `?raw` import that silently returned an empty
     * string let a prefers-reduced-motion test pass against 18,087 characters of nothing. */
    expect(APP_CSS.length).toBeGreaterThan(10_000);
    expect(colorDeclarations(APP_CSS).length).toBeGreaterThan(20);
  });

  test('no `color:` declaration paints --color-accent, except the one sanctioned above', () => {
    const offenders = colorDeclarations(APP_CSS)
      /* The whole accent FAMILY, `--color-accent-600` included: a rule that caught only the
       * base token would wave through `color:var(--color-accent-600)`, which is 3.95 / 4.25 as
       * text and is exactly where the link hover sits. */
      .filter((d) => /var\(--color-accent(?:-\d+)?\)/.test(d.value))
      .filter((d) => !SANCTIONED_FILL_AS_TEXT.has(d.selector))
      .map((d) => `${d.selector} { color: ${d.value} }`);
    expect(offenders, 'accent as TEXT must use --accent-ink (spec §5.4)').toEqual([]);
  });

  test('the four usages that moved are still on the ink token', () => {
    /* Named individually rather than counted, because a count passes after someone deletes one
     * and adds another. Each of these is accent text on a ground the audit now measures:
     * `--color-bg` for the first three, the 12% accent wash for `.pk`. */
    const byColor = new Map(colorDeclarations(APP_CSS).map((d) => [d.selector, d.value]));
    for (const selector of ['.ghost[aria-pressed=true]', '.swipe .grab', '.zbtn:hover', '.pk[aria-pressed=true]']) {
      expect(byColor.get(selector), `${selector} must paint its text with --accent-ink`).toContain('var(--accent-ink)');
    }
  });

  test('the FILL token keeps every non-text job it had, because only text moved (§5.4)', () => {
    /* The opposite failure: someone "fixing" the audit by replacing the token everywhere would
     * repaint borders, outlines and the range thumb with a colour derived for legibility
     * against a ground they never touch - a visible change with no sanction in §3. */
    for (const decl of [
      '.ghost[aria-pressed=true]{border-color:var(--color-accent)',
      '.pk[aria-pressed=true]{border-color:var(--color-accent)',
      '.zbtn:hover{border-color:var(--color-accent)',
      ':focus-visible{outline:2px solid var(--color-accent)',
      'input[type=range]{width:100%;accent-color:var(--color-accent)',
    ]) {
      expect(APP_CSS, `${decl} is a FILL and must not move to the ink scale`).toContain(decl);
    }
    // And the washes stay mixed from the fill, which is what makes the audited ground the
    // ground that is actually painted.
    expect(APP_CSS).toContain('background:color-mix(in srgb,var(--color-accent) 12%,transparent)');
  });
});
