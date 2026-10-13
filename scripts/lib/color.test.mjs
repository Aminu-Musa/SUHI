import { describe, it, expect } from 'vitest';
import { hexToOklch, oklchToHex, contrastRatio, relativeLuminance } from './color.mjs';

it('round-trips a hex through OKLCH', () => {
  const { L, C, H } = hexToOklch('#35c07d');
  expect(oklchToHex(L, C, H)).toBe('#35c07d');
});

it('computes known relative luminances', () => {
  expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
});

it('computes known contrast ratios', () => {
  expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  expect(contrastRatio('#eef1f5', '#242931')).toBeCloseTo(12.90, 1);
  expect(contrastRatio('#14171c', '#e9ebed')).toBeCloseTo(15.03, 1);
});

it('clamps out-of-gamut OKLCH to a valid hex', () => {
  expect(oklchToHex(0.95, 0.4, 0)).toMatch(/^#[0-9a-f]{6}$/);
});
