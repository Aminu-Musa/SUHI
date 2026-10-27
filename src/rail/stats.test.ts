/* `signed`, and the rule that it has exactly one owner.
 *
 * Task 10 found three identical four-line copies of this helper in `Drawer.tsx`, `Tooltip.tsx`
 * and `Reports.tsx`, and left them rather than widen its own diff — correctly. Task 11 moved it
 * here beside `fmt`. This codebase's organising rule is that every derivation has exactly one
 * owner: `encode.mjs` owns what a colour means, `ink.mjs` the text scale, `derive.mjs` the
 * published figures. A sign test is a small derivation, but three copies of it is the same
 * smell at smaller scale — and §9.1 bug 11 is what happens when a sign test is written inline
 * at one call site and forgotten at the next.
 *
 * The rest of stats.ts (`kpiStats`, `statSpots`, `confBins`, `spotValue`) is exercised against
 * the real 441 features by `src/rail/Kpis.test.tsx`, which renders the tiles it feeds. Nothing
 * is duplicated here.
 */

import { expect, test } from 'vitest';
import drawerSrc from '../map/Drawer.tsx?raw';
import tooltipSrc from '../map/Tooltip.tsx?raw';
import reportsSrc from '../views/Reports.tsx?raw';
import { signed } from './stats';

test('signs a positive value, leaves a negative one alone, and never writes +-', () => {
  expect(signed(2.34)).toBe('+2.34');
  expect(signed(0.01)).toBe('+0.01');
  // §9.1 bug 11 is exactly this case: the original wrote a bare `+` and printed `+-0.66 °C`.
  expect(signed(-0.66)).toBe('-0.66');
  expect(signed(-0.01)).toBe('-0.01');
  expect(`${signed(-0.66)} °C`).not.toContain('+-');
});

test('ZERO is not signed, which is the behaviour all three original call sites had', () => {
  /* `0 > 0` is false, so zero reads `0` rather than `+0`. Worth pinning: a "fix" to `>=` would
   * change the drawer, the tooltip and the brief at once, and none of them wants `+0 °C`. */
  expect(signed(0)).toBe('0');
  expect(signed(-0)).toBe('0');
});

test('ONE OWNER: no module keeps a local copy of signed any more', () => {
  /* Read through Vite's `?raw`, so the assertion is on the shipped text rather than on what a
   * mock says. The three lengths are asserted first because `?raw` returns an EMPTY STRING when
   * `test.css` is off, and a `not.toMatch` against '' passes having read nothing. */
  const sources = { Drawer: drawerSrc, Tooltip: tooltipSrc, Reports: reportsSrc };
  for (const [name, src] of Object.entries(sources)) {
    expect(src.length, `${name}.tsx read back ${src.length} characters`).toBeGreaterThan(1_000);
    expect(src, `${name}.tsx must not redefine signed`).not.toMatch(/const signed\s*=/);
    expect(src, `${name}.tsx must import signed from stats`).toMatch(/import \{[^}]*\bsigned\b[^}]*\} from '\.\.?\/[\w/]*stats'/);
  }
  /* `signedF` is NOT consolidated and that is deliberate: it formats as well as signs, it exists
   * at one call site, and one definition at one call site is already one owner. */
  expect(drawerSrc).toMatch(/const signedF\s*=/);
  expect(tooltipSrc).not.toMatch(/signedF/);
  expect(reportsSrc).not.toMatch(/signedF/);
});
