import { describe, it, expect } from 'vitest';
import { buildRamp, RAMPS } from './ramps.mjs';
import { hexToOklch, relativeLuminance } from './color.mjs';
import { THEME_TOKENS } from './tokens.mjs';

const THEMES = Object.keys(THEME_TOKENS);

it('defines a ramp for exactly the themes in THEME_TOKENS', () => {
  expect(Object.keys(RAMPS).sort()).toEqual([...THEMES].sort());
});

it('reproduces the spec ramp literals', () => {
  expect(buildRamp(RAMPS.nocturne.hot)).toEqual(
    ['#8d3a32', '#b45f37', '#d6883e', '#f2b64e', '#ffe76c']);
  expect(buildRamp(RAMPS.nocturne.cold)).toEqual(
    ['#335698', '#4f7cb4', '#71a2cf', '#98c9eb', '#c4efff']);
  expect(buildRamp(RAMPS.modernist.hot)).toEqual(
    ['#ebd06b', '#dba33f', '#c6761e', '#ac4a11', '#8d1b17']);
  expect(buildRamp(RAMPS.modernist.cold)).toEqual(
    ['#aad9f2', '#7db2d8', '#558bbe', '#3563a4', '#203a89']);
});

// Review Focus 3 — a ramp whose steps are confusable must fail the build
it.each(THEMES)('keeps every %s step >= 0.07 apart in lightness', (theme) => {
  for (const family of ['hot', 'cold']) {
    const ls = buildRamp(RAMPS[theme][family]).map(h => hexToOklch(h).L);
    for (let i = 1; i < ls.length; i++) {
      expect(Math.abs(ls[i] - ls[i - 1])).toBeGreaterThanOrEqual(0.07);
    }
  }
});

// Direction guard — the spacing test above uses Math.abs, so an inverted ramp would pass it.
// Invariant: lightness moves AWAY from the ground as intensity rises. On a dark ground that means
// lightness climbs; on a light ground it descends. The ground is read from THEME_TOKENS, so the
// guard survives any palette or theme rename. (The previous dashboard shipped the dark ramp
// inverted: the mildest hot spots were the most visible and severe ones sank into the map.)
describe('ramp direction', () => {
  const lightness = (p) => buildRamp(p).map(h => hexToOklch(h).L);
  const strictly = (ls, sign) => ls.every((l, i) => i === 0 || sign * (l - ls[i - 1]) > 0);
  const signFor = (theme) => (relativeLuminance(THEME_TOKENS[theme]['--bg']) < 0.2 ? +1 : -1);
  const cases = THEMES.flatMap(t => ['hot', 'cold'].map(f => [t, f]));

  it.each(cases)('%s %s ramp moves away from the ground as intensity rises', (theme, family) => {
    expect(strictly(lightness(RAMPS[theme][family]), signFor(theme))).toBe(true);
  });

  it('classifies at least one dark and one light ground (guard is exercised both ways)', () => {
    expect(new Set(THEMES.map(signFor)).size).toBe(2);
  });
});
