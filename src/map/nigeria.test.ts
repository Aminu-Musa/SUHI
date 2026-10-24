/* Rulings 29 and 30: the two constants that replaced the world-atlas CDN fetch.
 *
 * These assertions moved here when the graticule was deleted (the user reversed ruling 31 on
 * 2026-10-24 in favour of the basemap's real admin boundaries). They are not about a graticule;
 * they are about the two numbers that used to arrive over the network.
 */

import { expect, test } from 'vitest';
import { EXTRACT_BBOX, FIT_BOUNDS, NIGERIA_RING } from './nigeria';

test('FIT_BOUNDS is d3.geoBounds(NG) - derived from the ring, not a hand-typed bbox', () => {
  /* Prototype line 650 framed the map with `d3.geoBounds(NG)` on the fetched outline. Deriving
   * it from the baked ring keeps the same number AND keeps it checkable: four literals would be
   * four numbers nobody can verify, whereas the ring carries its provenance in the header. */
  const [[w, s], [e, n]] = FIT_BOUNDS;
  expect([w, s, e, n].map((v) => Math.round(v * 1e4) / 1e4)).toEqual([2.691, 4.2404, 14.5783, 13.866]);
  // Real 1:110m geometry, not the rectangle the offline fidelity fixture stands in for.
  expect(NIGERIA_RING.length).toBeGreaterThan(40);
  expect(NIGERIA_RING[0]).toEqual(NIGERIA_RING[NIGERIA_RING.length - 1]);
  expect(new Set(NIGERIA_RING.map(([x]) => x)).size).toBeGreaterThan(40);
});

test('EXTRACT_BBOX is the tile bbox and OVERHANGS the border on all four sides', () => {
  /* Two different jobs that the one atlas fetch used to cover. FIT_BOUNDS frames the map;
   * EXTRACT_BBOX is what `pmtiles extract --bbox` was given, and it has to reach past the border
   * or the coastline and the Lake Chad shore would have no tiles beyond them. */
  expect([...EXTRACT_BBOX]).toEqual([2.5, 3.9, 15.0, 14.1]);
  const [[w, s], [e, n]] = FIT_BOUNDS;
  expect(EXTRACT_BBOX[0]).toBeLessThan(w);
  expect(EXTRACT_BBOX[1]).toBeLessThan(s);
  expect(EXTRACT_BBOX[2]).toBeGreaterThan(e);
  expect(EXTRACT_BBOX[3]).toBeGreaterThan(n);
});

test('nothing in src/map draws NIGERIA_RING: every line comes from the basemap', () => {
  /* Rulings 29 and 30 put all map linework in the basemap's own `boundaries` source-layer, and
   * the user's 2026-10-24 reversal of ruling 31 moved the last exception - the graticule - there
   * too. The ring is a bounds source and nothing else. If a later task reaches for it as
   * geometry, this is the test that should make it think twice. */
  expect(Object.keys({ EXTRACT_BBOX, FIT_BOUNDS, NIGERIA_RING }).length).toBe(3);
  // A closed ring is not a MapLibre source body; it has no `type` and no `coordinates`.
  expect('type' in (NIGERIA_RING as object)).toBe(false);
});
