import { it, expect } from 'vitest';
import { hexToOklch, oklchToHex, contrastRatio, relativeLuminance, mixSrgb } from './color.mjs';

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

/* `mixSrgb` — added in Task 12 for the one ground that is not a declared token.
 *
 * `.pk[aria-pressed=true]` (app.css 251) washes its ground with
 * `color-mix(in srgb, var(--color-accent) 12%, transparent)` over the page, and accent TEXT
 * sits on the result. The ink scale is derived against DECLARED tokens, so that composite was
 * a ground nothing had measured - and it was the one that failed: 3.17:1 in Modernist, found
 * by axe in tests/a11y.spec.ts. This function is what lets `ink.mjs` name it. */
it('mixSrgb composites a foreground over a ground at a percentage, as CSS color-mix does', () => {
  // The browser's own answer for the .pk wash, read from a rendered page: 12% #ec3013 over
  // Modernist's #f3f2f2 computes to #f2dbd7. Any drift from CSS's rounding shows up here.
  expect(mixSrgb('#ec3013', '#f3f2f2', 0.12)).toBe('#f2dbd7');
  // And Nocturne's, over #161826.
  expect(mixSrgb('#9184d9', '#161826', 0.12)).toBe('#25253b');
});

it('mixSrgb returns each end of the range exactly', () => {
  expect(mixSrgb('#ec3013', '#f3f2f2', 0)).toBe('#f3f2f2');
  expect(mixSrgb('#ec3013', '#f3f2f2', 1)).toBe('#ec3013');
});

it('mixSrgb rejects a percentage outside 0..1, because a caller passing 12 means 1200%', () => {
  expect(() => mixSrgb('#ec3013', '#f3f2f2', 12)).toThrow(/0\.\.1/);
  expect(() => mixSrgb('#ec3013', '#f3f2f2', -0.1)).toThrow(/0\.\.1/);
});
