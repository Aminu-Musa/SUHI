import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';
import { renderInkCss, INK_CSS_PATH } from '../ink.mjs';
import { hexToOklch, oklchToHex, contrastRatio, mixSrgb } from './color.mjs';
import { THEME_TOKENS } from './tokens.mjs';
import { deriveInk, INK_TOKENS, INK_STEP, TEXT_GROUNDS, TEXT_FLOOR, INK_SOURCES, INK_EXTRA_GROUNDS } from './ink.mjs';

const groundsOf = (theme) => TEXT_GROUNDS.map((g) => THEME_TOKENS[theme][g]);

/** The table in spec §5.4, verbatim. It is the contract: a different search step, a
 *  different rounding, or a different minimisation target produces different hexes. */
const SPEC_5_4 = {
  nocturne: {
    '--hot-1-ink': '#f6e08a',
    '--hot-2-ink': '#f2c14e',
    '--hot-3-ink': '#ec9a3c',
    '--hot-4-ink': '#e67035',
    '--hot-5-ink': '#f56251',
    '--cold-1-ink': '#cfe4f7',
    '--cold-2-ink': '#8fbfe8',
    '--cold-3-ink': '#5a96d4',
    '--cold-4-ink': '#5e93dc',
    '--cold-5-ink': '#6d92d5',
    '--accent-ink': '#9386dc',
  },
  modernist: {
    '--hot-1-ink': '#8b5900',
    '--hot-2-ink': '#9b5000',
    '--hot-3-ink': '#ac4200',
    '--hot-4-ink': '#b83410',
    '--hot-5-ink': '#8e1408',
    '--cold-1-ink': '#45687f',
    '--cold-2-ink': '#2d6896',
    '--cold-3-ink': '#2965a8',
    '--cold-4-ink': '#23539b',
    '--cold-5-ink': '#12306b',
    // TASK 12: #cb0000 until the 12% accent wash became a ground for this token - one 0.002
    // step. See INK_EXTRA_GROUNDS below and spec §5.4.
    '--accent-ink': '#ca0000',
  },
};

describe('deriveInk', () => {
  test('holds hue and chroma, moves only lightness', () => {
    // `oklch` is the triple the search accepted, before 8-bit quantisation to hex: the
    // search must not adjust H or C at all (no gamut-aware chroma reduction, no hue drift).
    for (const theme of ['nocturne', 'modernist']) {
      const dir = theme === 'nocturne' ? 1 : -1;
      for (const source of Object.values(INK_SOURCES)) {
        const from = THEME_TOKENS[theme][source];
        const a = hexToOklch(from);
        const { oklch, moved } = deriveInk(from, { grounds: groundsOf(theme), dir, floor: TEXT_FLOOR });
        expect(Math.abs(oklch.H - a.H)).toBeLessThan(1e-9);
        expect(Math.abs(oklch.C - a.C)).toBeLessThan(1e-9);
        expect(Math.abs(oklch.L - (a.L + dir * moved))).toBeLessThan(1e-12);
      }
    }
  });

  test('returns the input unchanged when it already clears the floor', () => {
    const from = THEME_TOKENS.nocturne['--hot-1']; // 13.37 on the map ground already
    const r = deriveInk(from, { grounds: groundsOf('nocturne'), dir: 1, floor: TEXT_FLOOR });
    expect(r.hex).toBe(from);
    expect(r.moved).toBe(0);
  });

  test('nocturne lightens and modernist darkens', () => {
    const noc = THEME_TOKENS.nocturne['--cold-5'];
    const mod = THEME_TOKENS.modernist['--hot-1'];
    const lifted = deriveInk(noc, { grounds: groundsOf('nocturne'), dir: 1, floor: TEXT_FLOOR });
    const dropped = deriveInk(mod, { grounds: groundsOf('modernist'), dir: -1, floor: TEXT_FLOOR });
    expect(hexToOklch(lifted.hex).L).toBeGreaterThan(hexToOklch(noc).L);
    expect(hexToOklch(dropped.hex).L).toBeLessThan(hexToOklch(mod).L);
  });

  test('clears the floor on every ground, not just the worst one', () => {
    for (const theme of ['nocturne', 'modernist']) {
      const dir = theme === 'nocturne' ? 1 : -1;
      const grounds = groundsOf(theme);
      for (const source of Object.values(INK_SOURCES)) {
        const { hex } = deriveInk(THEME_TOKENS[theme][source], { grounds, dir, floor: TEXT_FLOOR });
        for (const ground of grounds) expect(contrastRatio(hex, ground)).toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    }
  });

  test('stops at the first step that clears the floor — the move is minimal', () => {
    const grounds = groundsOf('modernist');
    for (const source of Object.values(INK_SOURCES)) {
      const from = THEME_TOKENS.modernist[source];
      const { moved } = deriveInk(from, { grounds, dir: -1, floor: TEXT_FLOOR });
      if (moved === 0) continue;
      const { L, C, H } = hexToOklch(from);
      const previous = oklchToHex(L - (moved - INK_STEP), C, H);
      expect(Math.min(...grounds.map((g) => contrastRatio(previous, g)))).toBeLessThan(TEXT_FLOOR);
    }
  });

  test('searches in steps of 0.002 OKLCH L', () => {
    expect(INK_STEP).toBe(0.002);
    for (const theme of ['nocturne', 'modernist']) {
      const dir = theme === 'nocturne' ? 1 : -1;
      for (const source of Object.values(INK_SOURCES)) {
        const { moved } = deriveInk(THEME_TOKENS[theme][source], {
          grounds: groundsOf(theme),
          dir,
          floor: TEXT_FLOOR,
        });
        expect(Math.abs(Math.round(moved / INK_STEP) * INK_STEP - moved)).toBeLessThan(1e-12);
      }
    }
  });

  test('derives 11 ink tokens per theme, 22 in all, matching spec §5.4 exactly', () => {
    // The brief and spec §5.4/§9.2 say "twenty-one"; that is an arithmetic slip in the
    // spec, corrected by the coordinator. Ten ramp inks plus --accent-ink is 11 names per
    // theme and 22 declarations across both, which is also what ink.css contains.
    for (const theme of ['nocturne', 'modernist']) {
      expect(Object.keys(SPEC_5_4[theme])).toHaveLength(11);
      expect(INK_TOKENS(theme)).toEqual(SPEC_5_4[theme]);
    }
    expect(Object.values(SPEC_5_4).flatMap((t) => Object.values(t))).toHaveLength(22);
  });
});

describe('src/styles/ink.css', () => {
  test('committed ink.css matches a fresh derivation', () => {
    // The guard that makes a hand-edited ink token fail the build. Run `npm run ink`.
    expect(readFileSync(INK_CSS_PATH, 'utf8')).toBe(renderInkCss());
  });

  test('declares every ink token in both themes', () => {
    const css = readFileSync(INK_CSS_PATH, 'utf8');
    for (const theme of ['nocturne', 'modernist']) {
      const block = css.split(`html[data-theme="${theme}"] {`)[1].split('}')[0];
      for (const [name, hex] of Object.entries(SPEC_5_4[theme])) {
        expect(block).toContain(`${name}: ${hex};`);
      }
    }
  });
});

describe('INK_TOKENS', () => {
  test('names the three text grounds the ink scale is derived against', () => {
    expect(TEXT_GROUNDS).toEqual(['--color-bg', '--ui-panel-2', '--ui-tip']);
  });

  test('derives --accent-ink from --color-accent, not from --accent-fill', () => {
    expect(INK_SOURCES['--accent-ink']).toBe('--color-accent');
  });
});

/* TASK 12. The ink scale was derived against the three DECLARED grounds, and `.pk[aria-pressed
 * =true]` (app.css 251) puts accent text on a ground that is not one of them: the page washed
 * with `color-mix(in srgb, var(--color-accent) 12%, transparent)`. That composite was never
 * measured, and it was the pair that failed - axe read 3.17:1 on four Compare pickers in
 * Modernist, which is the first real contrast failure the audit's 80 green rows did not see.
 *
 * TEXT_GROUNDS IS STILL THREE. Adding a fourth global ground would re-derive all 22 values
 * across both themes, which is the cost ruling 48 declined for print and declines again here;
 * `src/styles/print.test.ts` pins the count at 3 and still passes. The wash is a ground for
 * ONE token, because `--accent-ink` is the only ink that ever sits on it, so it is declared per
 * token instead. Cost: Modernist's `--accent-ink` moves one 0.002 step, #cb0000 -> #ca0000. */
describe('INK_EXTRA_GROUNDS (task 12)', () => {
  test('names the 12% accent wash as an extra ground for --accent-ink alone', () => {
    expect(Object.keys(INK_EXTRA_GROUNDS)).toEqual(['--accent-ink']);
    // Still three GLOBAL grounds: the whole point of a per-token extra is not re-deriving 22
    // values. print.test.ts asserts the same count from the other side.
    expect(TEXT_GROUNDS).toHaveLength(3);
  });

  test('the wash is the accent at 12% over --color-bg, which is where .pk sits', () => {
    /* LITERAL HEXES, not `mixSrgb(...)` on both sides. The first version of this test computed
     * the expectation with the same call the implementation makes, so changing 0.12 to 0.22 -
     * or `--color-bg` to `--ui-panel-2` - in both places left it green: two spellings of one
     * expression, asserting that a function equals itself. These two values are the browser's
     * own, read off the rendered page, and they are the same pair `color.test.mjs` pins for
     * `mixSrgb` and `ink.css` records in its generated comment. */
    expect(INK_EXTRA_GROUNDS['--accent-ink'](THEME_TOKENS.modernist)).toEqual(['#f2dbd7']);
    expect(INK_EXTRA_GROUNDS['--accent-ink'](THEME_TOKENS.nocturne)).toEqual(['#25253b']);
    // And the composite really is the accent over the PAGE, not over a panel: `.pk` sets
    // `background:none` and `.panel` declares none either, so the ground is `--color-bg`.
    for (const theme of ['nocturne', 'modernist']) {
      const tokens = THEME_TOKENS[theme];
      expect(INK_EXTRA_GROUNDS['--accent-ink'](tokens)[0]).not.toBe(
        mixSrgb(tokens['--color-accent'], tokens['--ui-panel-2'], 0.12),
      );
    }
  });

  test('--accent-ink clears 4.5:1 on the wash as well as on all three grounds', () => {
    for (const theme of ['nocturne', 'modernist']) {
      const tokens = THEME_TOKENS[theme];
      const ink = INK_TOKENS(theme)['--accent-ink'];
      const grounds = [...TEXT_GROUNDS.map((g) => tokens[g]), ...INK_EXTRA_GROUNDS['--accent-ink'](tokens)];
      for (const ground of grounds) {
        const ratio = contrastRatio(ink, ground);
        expect(ratio, `${theme} --accent-ink (${ink}) on ${ground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          TEXT_FLOOR,
        );
      }
    }
  });

  test('--color-accent itself FAILS on the wash, so the move to the ink token is what fixes it', () => {
    /* Without this the test above would pass against a page that never moved: it would be
     * measuring the ink token while the stylesheet painted the fill. 3.17:1 is what axe read
     * off the rendered page before the change. */
    const tokens = THEME_TOKENS.modernist;
    const wash = INK_EXTRA_GROUNDS['--accent-ink'](tokens)[0];
    expect(contrastRatio(tokens['--color-accent'], wash)).toBeLessThan(TEXT_FLOOR);
  });
});
