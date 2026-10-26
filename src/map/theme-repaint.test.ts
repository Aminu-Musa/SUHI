/* REVIEW FOCUS 4 - a theme change must re-apply map paint, on BOTH instances.
 *
 * MapLibre bakes resolved hex into its parsed style object and never re-reads CSS, so a
 * `data-theme` flip repaints the whole UI and leaves the map exactly as it was. Every other
 * consumer in this app is fixed by the cascade; the map is not, which is the only reason
 * `paintEpoch` exists.
 *
 * MapLibre DOES NOT RUN IN jsdom, so there is no map here to interrogate and none is faked - a
 * recorder standing in for `setPaintProperty` would assert that our mock was called, which is a
 * test of the mock. Instead the DERIVATION is tested, which is where a repaint bug actually
 * lives: a property set when the layer is created and forgotten when the theme changes. One
 * module produces both (`paint.ts`), and these tests hold the two sides to each other.
 *
 * Ruling 35 doubles the surface: there are two map instances, each with one period's three
 * layers, so "every layer repainted" has to mean six layers and not three.
 */

import { expect, test } from 'vitest';
import { THEMES, type Theme } from '../app/ThemeProvider';
import { INITIAL_STATE } from '../app/state';
import {
  PERIODS,
  SPOT_LAYERS,
  THEME_DEPENDENT_PAINT,
  layerPaint,
  overlayLayers,
  periodLayers,
  repaintPatch,
  type PaintState,
} from './paint';

const STATE: PaintState = { year: INITIAL_STATE.year, contour: INITIAL_STATE.contour, opacity: INITIAL_STATE.opacity };

/** Every layer's full paint for a theme - "a map built fresh in that theme". */
const build = (theme: Theme, state: PaintState = STATE): Record<string, Record<string, unknown>> =>
  Object.fromEntries(overlayLayers().map((l) => [l.id, layerPaint(l, theme, state)]));

/** The same map after a theme change: the old paint with the repaint pass applied over it. This
 * is `applyPaint`'s effect, written as data - `setPaintProperty` replaces one key at a time and
 * leaves every key it is not given alone, which is precisely what a spread does. */
const afterThemeChange = (from: Theme, to: Theme, state: PaintState = STATE): Record<string, Record<string, unknown>> =>
  Object.fromEntries(overlayLayers().map((l) => [l.id, { ...layerPaint(l, from, state), ...repaintPatch(l, to, state) }]));

test('changing theme re-applies every paint property whose value depends on the theme', () => {
  /* THE ASSERTION IS PHRASED FROM THE PAINT'S SIDE, NOT THE REPAINT'S, and that is the whole
   * point: it enumerates the properties that genuinely differ between the two themes and then
   * demands each one be in the repaint pass. A test written the other way round - "the repaint
   * sets fill-color and line-color" - would pass unchanged on the day someone adds a third
   * theme-coloured property to `addLayer` and forgets `applyPaint`, which is the bug. */
  const a = build('nocturne');
  const b = build('modernist');
  const differing = new Set<string>();
  for (const layer of overlayLayers()) {
    for (const key of Object.keys(a[layer.id])) {
      if (JSON.stringify(a[layer.id][key]) !== JSON.stringify(b[layer.id][key])) differing.add(key);
    }
  }
  // Guard the guard: if the two themes ever resolved to the same tokens this set would be empty
  // and the loop below would check nothing.
  expect([...differing].sort()).toEqual([...THEME_DEPENDENT_PAINT].sort());

  for (const layer of overlayLayers()) {
    const patch = Object.keys(repaintPatch(layer, 'modernist', STATE));
    for (const key of differing) {
      if (!(key in build('nocturne')[layer.id])) continue; // a line key on a fill layer
      expect(patch, `${layer.id} must re-apply ${key} on a theme change`).toContain(key);
    }
  }
});

test('paint after a theme change matches a fresh build in that theme', () => {
  /* Equality IS the assertion, in both directions, because a repaint that sets the right keys
   * to slightly wrong values fails this and passes the test above. A `data-theme` flip alone -
   * no repaint at all - leaves `afterThemeChange` equal to `build(from)` and fails it. */
  for (const from of THEMES) {
    for (const to of THEMES) {
      expect(afterThemeChange(from, to)).toEqual(build(to));
    }
  }
});

test('a theme flip with nothing re-applied is NOT equal to a fresh build - the test above can fail', () => {
  /* The mutation this file exists to catch, asserted directly rather than trusted: skipping the
   * repaint leaves the map on the old palette. Without this, `toEqual` above could be passing
   * because both sides are derived from the same call and never actually differ. */
  expect(build('nocturne')).not.toEqual(build('modernist'));
});

test('the repaint reaches BOTH instances - six layers, not one period`s three (ruling 35)', () => {
  /* The swipe put the night spots in a second MapLibre instance. A repaint that looped the day
   * instance only would leave the right-hand side of the swipe on the previous palette, which
   * would read as a rendering artefact rather than as a bug. */
  expect(SPOT_LAYERS).toHaveLength(6);
  expect(overlayLayers().map((l) => l.id)).toEqual([...SPOT_LAYERS]);
  const covered = PERIODS.flatMap((p) =>
    overlayLayers()
      .filter((l) => l.period === p)
      .map((l) => l.id),
  );
  expect(covered.sort()).toEqual([...SPOT_LAYERS].sort());
  for (const p of PERIODS) expect(periodLayers(p)).toHaveLength(3);
});

test('the repaint patch is a SUBSET of the creation paint, never a different value', () => {
  /* If the two ever disagreed, a layer would look one way when it was created and another way
   * after the first theme change - and only one of them would be the design. */
  for (const theme of THEMES) {
    for (const layer of overlayLayers()) {
      const full = layerPaint(layer, theme, STATE);
      for (const [key, value] of Object.entries(repaintPatch(layer, theme, STATE))) {
        expect(key in full).toBe(true);
        expect(value).toEqual(full[key]);
      }
    }
  }
});

test('line-dasharray is deliberately NOT re-applied: it is a constant, and re-setting it restarts the cross-fade', () => {
  /* The one property left out of the repaint, documented at the call site and pinned here so
   * the omission reads as a decision rather than as the very bug Review Focus 4 is about. It is
   * identical in both themes, which is what makes leaving it out safe. */
  const nonsig = overlayLayers().filter((l) => l.significant === false);
  expect(nonsig).toHaveLength(2);
  for (const layer of nonsig) {
    expect(layerPaint(layer, 'nocturne', STATE)['line-dasharray']).toEqual([3, 3]);
    expect(layerPaint(layer, 'modernist', STATE)['line-dasharray']).toEqual([3, 3]);
    expect(Object.keys(repaintPatch(layer, 'nocturne', STATE))).not.toContain('line-dasharray');
  }
});

test('the year, contour and opacity are re-applied by the same pass, so a slider cannot go stale either', () => {
  // `applyPaint` is one pass over `repaintPatch`, so these travel with the colours by
  // construction. Pinned because the opposite - a separate pass per slider - is the obvious
  // shape and the one that drifts.
  const base: PaintState = { year: 2024, contour: 'all', opacity: 0.85 };
  const moved: PaintState = { year: 2015, contour: 'L90', opacity: 0.4 };
  const fill = overlayLayers().find((l) => l.type === 'fill');
  expect(fill).toBeDefined();
  const a = repaintPatch(fill!, 'nocturne', base);
  const b = repaintPatch(fill!, 'nocturne', moved);
  expect(a['fill-color']).not.toEqual(b['fill-color']);
  expect(a['fill-opacity']).not.toEqual(b['fill-opacity']);
});
