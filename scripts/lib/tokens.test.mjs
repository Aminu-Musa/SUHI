import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, test, expect } from 'vitest';
import { THEME_TOKENS, THEMES } from './tokens.mjs';

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'styles', 'suhi-tokens.css');
const css = () => readFileSync(CSS_PATH, 'utf8');

/** A value this repo can hand to color.mjs's parseHex: six-digit hex, lowercase. */
const HEX = /^#[0-9a-f]{6}$/;
/** Anything written as a hex literal, however many digits — used to spot #rgb and #rrggbbaa. */
const HEX_SHAPED = /^#[0-9a-f]{3,8}$/i;

/**
 * Every `html[data-theme="<theme>"]` block in the stylesheet, as a list (not a map), so the
 * tests below can see a repeated selector and a repeated declaration rather than silently
 * keeping the first block and the last value. Each block is a list of [name, value] pairs in
 * source order.
 */
function themeBlocks(theme) {
  const text = css();
  const selector = `html[data-theme="${theme}"] {`;
  const blocks = [];
  for (let at = text.indexOf(selector); at !== -1; at = text.indexOf(selector, at + 1)) {
    const end = text.indexOf('\n}', at);
    expect(end, `unterminated block for ${theme}`).toBeGreaterThan(at);
    const body = text.slice(at + selector.length, end);
    blocks.push([...body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)].map(([, n, v]) => [n, v.trim()]));
  }
  return blocks;
}

/** The single block for a theme, as a name -> value map. Fails if there is not exactly one. */
function themeBlock(theme) {
  const blocks = themeBlocks(theme);
  expect(blocks, `expected exactly one html[data-theme="${theme}"] block`).toHaveLength(1);
  return Object.fromEntries(blocks[0]);
}

/** The hex-valued declarations of a theme's CSS block — the subset THEME_TOKENS mirrors. */
function cssHexTokens(theme) {
  return Object.fromEntries(Object.entries(themeBlock(theme)).filter(([, v]) => HEX_SHAPED.test(v)));
}

describe('suhi-tokens.css structure', () => {
  test('imports ink.css — without it every --*-ink token is undefined in the browser while the JS-side audit still passes', () => {
    // The audit recomputes INK_TOKENS() in JavaScript and never reads the stylesheet, so
    // dropping this one line is invisible to `npm run audit` and to every other test here,
    // and ships the exact illegibility the ink scale exists to prevent.
    expect(css()).toContain('@import "./ink.css";');
  });

  test('declares each theme selector exactly once, so the block the tests parse is the block the browser paints', () => {
    // A second appended `html[data-theme="nocturne"] { … }` would win the cascade while the
    // parser below still read the first block — the audit would then be measuring a
    // background the page does not render.
    for (const theme of THEMES) expect(themeBlocks(theme)).toHaveLength(1);
  });

  test('declares each custom property at most once per block, so no value is shadowed by a later duplicate', () => {
    for (const theme of THEMES) {
      const names = themeBlocks(theme)[0].map(([name]) => name);
      const seen = new Set();
      const duplicates = names.filter((name) => (seen.has(name) ? true : (seen.add(name), false)));
      expect(duplicates, `duplicate declarations in ${theme}`).toEqual([]);
    }
  });
});

describe('THEME_TOKENS', () => {
  test('declares both themes', () => {
    expect(THEMES).toEqual(['nocturne', 'modernist']);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(THEME_TOKENS)).toBe(true);
    expect(Object.isFrozen(THEME_TOKENS.nocturne)).toBe(true);
  });

  test('holds six-digit hex only, because the contrast audit parses every value with parseHex', () => {
    // parseHex in scripts/lib/color.mjs accepts #rrggbb and nothing else, so an #rgb, an
    // #rrggbbaa, an rgba() or a color-mix() here would throw inside the audit rather than
    // fail a comparison. (Task 6's MapLibre paint is a weaker constraint: it needs a
    // concrete colour string, which is why no value may be a var(), but it would accept
    // rgba() happily.) --color-divider (color-mix) and --ui-scrim (rgba) are therefore
    // deliberately NOT mirrored here; a task that needs those resolved in JS should add a
    // separate non-hex map rather than loosen this.
    for (const theme of THEMES) {
      for (const [name, value] of Object.entries(THEME_TOKENS[theme])) {
        expect(value, `${theme} ${name}`).toMatch(HEX);
      }
    }
  });

  test('mirrors every hex-valued declaration in the CSS block, and nothing the CSS does not declare', () => {
    // Both directions. A token added to the CSS but not here resolves to undefined when
    // Task 6 builds MapLibre paint from these names; a token here but not in the CSS is a
    // value nothing renders.
    for (const theme of THEMES) {
      expect(Object.keys(THEME_TOKENS[theme]).sort(), theme).toEqual(Object.keys(cssHexTokens(theme)).sort());
    }
  });

  test('carries the same token names in both themes, so no theme is missing a token the other has', () => {
    const [first, ...rest] = THEMES;
    for (const theme of rest) {
      expect(Object.keys(THEME_TOKENS[theme]).sort(), theme).toEqual(Object.keys(THEME_TOKENS[first]).sort());
    }
  });

  test('every value agrees with the suhi-tokens.css block it mirrors', () => {
    for (const theme of THEMES) {
      const block = themeBlock(theme);
      for (const [name, value] of Object.entries(THEME_TOKENS[theme])) {
        expect(block[name], `${theme} ${name}`).toBe(value);
      }
    }
  });
});

describe('--neutral-mid', () => {
  test('neutral-mid duplicates neutral-800/400 as a literal because MapLibre paint cannot resolve var()', () => {
    // Spec §6.2 declares the diverging ramp's midpoint as the neutral-scale step. It is
    // written out as a hex in BOTH the CSS and THEME_TOKENS rather than as
    // var(--color-neutral-800), because Task 6 reads THEME_TOKENS in JavaScript to build
    // MapLibre paint expressions and MapLibre would receive the literal string
    // "var(--color-neutral-800)". This test is what stops the duplicate drifting.
    expect(THEME_TOKENS.nocturne['--neutral-mid']).toBe(THEME_TOKENS.nocturne['--color-neutral-800']);
    expect(THEME_TOKENS.modernist['--neutral-mid']).toBe(THEME_TOKENS.modernist['--color-neutral-400']);

    const noc = themeBlock('nocturne');
    const mod = themeBlock('modernist');
    expect(noc['--neutral-mid']).toBe(noc['--color-neutral-800']);
    expect(mod['--neutral-mid']).toBe(mod['--color-neutral-400']);
  });
});
