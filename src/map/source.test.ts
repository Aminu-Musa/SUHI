/* The spot source, against the real 441 features.
 *
 * The load-bearing assertion in this file is that reference means come from the UNFILTERED
 * feature set, and it only means anything against the shipped data: a synthetic fixture could be
 * made to agree with whatever the code did. `src/rail/fixtures.ts` is the same real
 * `data/spots.geojson` the browser fetches.
 */

import { expect, test } from 'vitest';
import { buildReferenceMeans, encodeValue } from '../lib/encode.mjs';
import { FIXTURE } from '../rail/fixtures';
import type { Spots } from '../app/data';
import { spotFeatures, spotReferenceMeans, spotSource } from './source';
import { exaggerate } from './exaggerate';

const SPOTS = FIXTURE.spots;
const subset = (predicate: (p: Spots['features'][number]['properties']) => boolean): Spots => ({
  type: 'FeatureCollection',
  features: SPOTS.features.filter((f) => predicate(f.properties)),
});

test('reference means are built from the unfiltered feature set', () => {
  /* THE REGRESSION THIS GUARDS, SPELLED OUT. A reference mean is "the mean mean_lst over this
   * city's L50 contours for this period" (spec §6.1). Build it from whatever the reader has
   * filtered to and the colour of a polygon starts depending on which OTHER polygons are on
   * screen: pick a cluster and every remaining spot changes colour with nothing to say why.
   * Filter to L75 or L90 and it is worse than wrong - buildReferenceMeans reads L50 rows only,
   * so it returns an EMPTY map, every lst_rel becomes null, and the whole map paints
   * --neutral-mid while looking perfectly healthy.
   *
   * Step 1: the two really do differ, so the rest of the test is not vacuous. */
  const unfiltered = buildReferenceMeans(SPOTS.features);
  const fromL90 = buildReferenceMeans(subset((p) => p.contour_level === 'L90').features);
  expect(unfiltered.size).toBeGreaterThan(100);
  expect(fromL90.size).toBe(0);
  expect([...unfiltered]).not.toEqual([...fromL90]);

  // A cluster filter also moves them, without emptying them - the subtler version of the bug.
  const fromCluster = buildReferenceMeans(subset((p) => String(p.cluster25) === '1').features);
  expect(fromCluster.size).toBeGreaterThan(0);
  expect(fromCluster.size).toBeLessThan(unfiltered.size);

  /* Step 2: the source really uses the unfiltered form. `spotReferenceMeans` takes the whole
   * `Spots` object and derives the means itself - there is no parameter a filtered slice could
   * enter through - and every injected lst_rel matches the unfiltered computation. */
  const refs = spotReferenceMeans(SPOTS);
  expect([...refs].sort()).toEqual([...unfiltered].sort());
  const feats = spotFeatures(SPOTS, 1);
  for (const f of feats) {
    expect(f.properties.lst_rel).toBe(encodeValue(f.properties, unfiltered));
  }
});

test('the means are computed ONCE per loaded dataset, not once per setData', () => {
  // Cached on the Spots OBJECT, so the zoom-bucket setData path does not re-aggregate 441
  // features every time the reader crosses a zoom boundary.
  expect(spotReferenceMeans(SPOTS)).toBe(spotReferenceMeans(SPOTS));
  const other = subset(() => true);
  expect(spotReferenceMeans(other)).not.toBe(spotReferenceMeans(SPOTS));
});

test('lst_rel is null - never undefined or NaN - for the 2 of 441 with no reference mean', () => {
  /* Bida|night and Port Harcourt|night: each is its city's only L50 night contour and has a null
   * mean_lst, so it is skipped when the means are built and there is nothing to subtract. The
   * fill expression tests `['==', ['get','lst_rel'], null]`, so this is the value it looks for. */
  const feats = spotFeatures(SPOTS, 1);
  expect(feats.length).toBe(441);
  const nulls = feats.filter((f) => f.properties.lst_rel === null);
  expect(nulls.map((f) => `${f.properties.city}|${f.properties.period}`).sort()).toEqual([
    'Bida|night',
    'Port Harcourt|night',
  ]);
  for (const f of feats) {
    const v = f.properties.lst_rel;
    expect(v === null || Number.isFinite(v)).toBe(true);
    expect(v).not.toBeUndefined();
  }
});

test('the observed range still straddles the ±4.5 domain, which is why clamping matters', () => {
  // If this ever stops being true, Review Focus 2's clamp test is still correct but no longer
  // describes real data - so the number belongs in a test rather than only in a comment.
  const vals = spotFeatures(SPOTS, 1)
    .map((f) => f.properties.lst_rel)
    .filter((v): v is number => typeof v === 'number');
  expect(Math.min(...vals)).toBeLessThan(-4.5);
  expect(Math.max(...vals)).toBeGreaterThan(4.5);
  expect(Math.min(...vals)).toBeCloseTo(-5.95, 1);
  expect(Math.max(...vals)).toBeCloseTo(6.64, 1);
});

test('the source carries ALL 441 features regardless of filter state, because filtering is setFilter', () => {
  // This is what removes the original's clearLayers()/addData() cycle: the source never
  // changes for a filter, only for a zoom bucket.
  expect(spotSource(SPOTS, 1).features.length).toBe(441);
  expect(spotSource(SPOTS, 9).features.length).toBe(441);
});

test('features are sorted L50 -> L75 -> L90, so the nested cores paint on top', () => {
  const levels = spotFeatures(SPOTS, 1).map((f) => f.properties.contour_level);
  const first = levels.indexOf('L75');
  const last = levels.lastIndexOf('L50');
  expect(last).toBeLessThan(first);
  expect(levels.lastIndexOf('L75')).toBeLessThan(levels.indexOf('L90'));
});

test('the factor reaches the geometry, and the properties survive the transform', () => {
  const plain = spotFeatures(SPOTS, 1);
  const big = spotFeatures(SPOTS, 9);
  expect(big[0].properties.spot_id).toBe(plain[0].properties.spot_id);
  expect(JSON.stringify(big[0].geometry)).not.toBe(JSON.stringify(plain[0].geometry));
  expect(JSON.stringify(big[0].geometry)).toBe(JSON.stringify(exaggerate(plain[0].geometry, 9)));
});
