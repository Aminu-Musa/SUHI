import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';
import { renderInkCss, INK_CSS_PATH } from '../ink.mjs';
import { hexToOklch, oklchToHex, contrastRatio } from './color.mjs';
import { THEME_TOKENS } from './tokens.mjs';
import { deriveInk, INK_TOKENS, INK_STEP, TEXT_GROUNDS, TEXT_FLOOR, INK_SOURCES } from './ink.mjs';

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
    '--accent-ink': '#cb0000',
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
