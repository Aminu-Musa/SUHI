/* RULING 9. The geometry transform, as a pure function.
 *
 * These are the tests that stand between the dashboard and an effectively empty map at its
 * default view. A median spot is 12.7 km2 - about 3 px at national zoom - so if the factor
 * silently became 1 the map would look like a working map with no data on it, which is the
 * hardest kind of regression to notice.
 */

import { expect, test } from 'vitest';
import { EXAG, LEVEL_ORDER, centroid, exagBucket, exagFactor, exaggerate } from './exaggerate';

/* A 1-degree square whose four vertices average to (10, 10). The ring is left UNCLOSED on
 * purpose: `centroid` is the unweighted mean of every coordinate pair, so repeating the first
 * point - as a real GeoJSON ring does - pulls the centre towards it. That quirk is transcribed
 * from the original and is asserted in its own test below; this fixture keeps the scale maths
 * readable by not mixing the two. */
const square = { type: 'Polygon', coordinates: [[[9.5, 9.5], [10.5, 9.5], [10.5, 10.5], [9.5, 10.5]]] };

test('geometry is scaled 9x at zoom 5 and 1x above zoom 8, about each centroid', () => {
  expect(exagFactor(5)).toBe(9);
  expect(exagFactor(6)).toBe(6);
  expect(exagFactor(7)).toBe(4);
  expect(exagFactor(8)).toBe(2.2);
  expect(exagFactor(9)).toBe(1);
  expect(exagFactor(16)).toBe(1);
  expect(EXAG).toEqual({ 5: 9, 6: 6, 7: 4, 8: 2.2 });

  const big = exaggerate(square, 9) as typeof square;
  const ring = big.coordinates[0];
  // 9x about (10, 10): the half-degree offsets become 4.5 degrees.
  expect(ring[0]).toEqual([10 - 4.5, 10 - 4.5]);
  expect(ring[2]).toEqual([10 + 4.5, 10 + 4.5]);
  // The CENTROID does not move - that is the whole point. A spot grows in place.
  expect(centroid(big)).toEqual([10, 10]);
});

test('the bucket is Math.floor, because Leaflet handed EXAG an integer and MapLibre does not', () => {
  /* The original indexed `EXAG[map.getZoom()]`, which only ever hit because Leaflet's default
   * zoomSnap:1 makes getZoom() an integer. MapLibre's zoom is continuous, so indexing it raw
   * would miss every key and return 1 - the empty map ruling 9 exists to prevent. fitBounds in
   * Leaflet picks the largest integer zoom that fits, i.e. the floor, so flooring is also what
   * reproduces WHICH bucket the original was in. */
  expect(exagBucket(5.73)).toBe(5);
  expect(exagFactor(5.73)).toBe(9);
  expect(exagFactor(7.99)).toBe(4);
  expect(exagFactor(8.01)).toBe(2.2);
  expect(exagFactor(8.99)).toBe(2.2);
  // There are exactly FIVE distinct factors across the map's whole zoom range (minZoom 5..16).
  const seen = new Set<number>();
  for (let z = 5; z <= 16; z += 0.05) seen.add(exagFactor(z));
  expect([...seen].sort((a, b) => a - b)).toEqual([1, 2.2, 4, 6, 9]);
});

test('the exag toggle switches it off, as it does in the original', () => {
  expect(exagFactor(5, false)).toBe(1);
  expect(exagFactor(8, false)).toBe(1);
});

test('k <= 1 returns the SAME geometry object, so an un-exaggerated render costs no allocation', () => {
  expect(exaggerate(square, 1)).toBe(square);
  expect(exaggerate(square, 0.5)).toBe(square);
});

test('a MultiPolygon is walked to every ring, and holes are preserved as holes', () => {
  const mp = {
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]], [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]]],
      [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]],
    ],
  };
  const out = exaggerate(mp, 3) as typeof mp;
  expect(out.type).toBe('MultiPolygon');
  expect(out.coordinates.length).toBe(2);
  expect(out.coordinates[0].length).toBe(2); // outer ring plus its hole
  expect(out.coordinates[1][0].length).toBe(5);
  // Every vertex moved; nothing collapsed to a number or to undefined.
  for (const poly of out.coordinates) for (const ring of poly) for (const pt of ring) {
    expect(pt.length).toBe(2);
    expect(Number.isFinite(pt[0]) && Number.isFinite(pt[1])).toBe(true);
  }
});

test('the centroid is the UNWEIGHTED vertex mean and returns [lat, lon], which is deliberate', () => {
  /* Both quirks are transcribed from prototype lines 706-708. It is NOT an area centroid:
   * ring-closing duplicates count twice and a MultiPolygon's parts are weighted by vertex count.
   * "Fixing" it would move some polygons relative to the approved render, which spec §3 makes
   * the authority. The [lat, lon] order is self-consistent with `exaggerate`, its only caller. */
  const tri = { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [0, 3], [0, 0]]] };
  // Four vertices, with [0,0] appearing twice: x mean = 3/4, y mean = 3/4.
  expect(centroid(tri)).toEqual([0.75, 0.75]);
  const skew = { type: 'Polygon', coordinates: [[[0, 0], [10, 4], [0, 0], [0, 0]]] };
  // lat first: y mean 1, x mean 2.5.
  expect(centroid(skew)).toEqual([1, 2.5]);
});

test('draw order is L50 outermost to L90 innermost, which is what makes the nesting read', () => {
  expect(LEVEL_ORDER).toEqual({ L50: 0, L75: 1, L90: 2 });
});
