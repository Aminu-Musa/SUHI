import { describe, it, expect } from 'vitest';
import { buildRamp, RAMPS } from './ramps.mjs';
import { hexToOklch } from './color.mjs';

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
it.each(['nocturne', 'modernist'])('keeps every %s step >= 0.07 apart in lightness', (theme) => {
  for (const family of ['hot', 'cold']) {
    const ls = buildRamp(RAMPS[theme][family]).map(h => hexToOklch(h).L);
    for (let i = 1; i < ls.length; i++) {
      expect(Math.abs(ls[i] - ls[i - 1])).toBeGreaterThanOrEqual(0.07);
    }
  }
});
