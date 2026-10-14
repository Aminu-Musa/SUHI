import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, test, expect } from 'vitest';
import { THEME_TOKENS, THEMES } from './tokens.mjs';

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'styles', 'suhi-tokens.css');

/** The declarations inside one `html[data-theme="…"]` block, as a name -> value map. */
function themeBlock(theme) {
  const css = readFileSync(CSS_PATH, 'utf8');
  const start = css.indexOf(`html[data-theme="${theme}"] {`);
  expect(start, `no block for ${theme}`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out = {};
  for (const [, name, value] of body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) out[name] = value.trim();
  return out;
}

describe('THEME_TOKENS', () => {
  test('declares both themes', () => {
    expect(THEMES).toEqual(['nocturne', 'modernist']);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(THEME_TOKENS)).toBe(true);
    expect(Object.isFrozen(THEME_TOKENS.nocturne)).toBe(true);
  });

  test('holds literal hexes only — Task 6 resolves these names in JS for MapLibre paint', () => {
    for (const theme of THEMES) {
      for (const [name, value] of Object.entries(THEME_TOKENS[theme])) {
        expect(value, `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test('every value agrees with the suhi-tokens.css block it mirrors', () => {
    for (const theme of THEMES) {
      const css = themeBlock(theme);
      for (const [name, value] of Object.entries(THEME_TOKENS[theme])) {
        expect(css[name], `${theme} ${name}`).toBe(value);
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
