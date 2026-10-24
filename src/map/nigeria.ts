/* Nigeria's extent and its outline ring, as constants.
 *
 * RULING 30 - NO WORLD-ATLAS FETCH. The original pulled
 * `world-atlas@2.0.2/countries-110m.json` from jsdelivr inside the same `Promise.all` as its
 * three local files (prototype line 595) and used the result for exactly two things: a national
 * outline and `d3.geoBounds(NG)`. One dropped request therefore rejected the whole chain - and
 * because `#loading` had already been removed by the time the `.catch` ran, the page looked
 * loaded while rendering zero KPIs, and the catch handler itself threw writing to an element
 * that no longer existed. Ruling 30 removes that failure mode and the last third-party map
 * dependency with it: the bounds are the named constant below and the drawn outline comes from
 * the basemap's own `boundaries` source-layer (see `style.ts`).
 *
 * WHAT THE RING IS STILL FOR, now that ruling 31 is reversed. It was added to clip the
 * `d3.geoGraticule` placeholder to Nigeria (§9.1 bug 6). The user approved real admin boundaries
 * on 2026-10-24, the graticule is deleted, and there is nothing left to clip - so the ring's one
 * remaining job is `FIT_BOUNDS`, which is `d3.geoBounds(NG)` and frames the map exactly as
 * prototype line 650 did. The 58 coordinates are kept rather than collapsed to four numbers
 * because the bounds are DERIVED from them below: a bbox typed by hand is a number nobody can
 * check, while a ring carries its own provenance.
 *
 * PROVENANCE. Natural Earth 1:110m admin-0 countries, public domain, via
 * `world-atlas@2.0.2/countries-110m.json` (sha256
 * 2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8), feature
 * `properties.name === 'Nigeria'`, single ring, longitude/latitude rounded to 4 decimal places
 * (about 11 m - far below a 1:110m source's own error). This is the same data the original
 * fetched, frozen at build time rather than requested at boot. NOTHING DRAWS IT: every line on
 * the map comes from the basemap's own `boundaries` source-layer.
 */

/** The ring, closed (first point repeated last), in [lon, lat]. */
export const NIGERIA_RING: readonly (readonly [number, number])[] = [
  [2.691, 6.2597], [2.7486, 7.871], [2.7234, 8.5074], [2.9106, 9.137], [3.2202, 9.4434],
  [3.7062, 10.0628], [3.6018, 10.332], [3.7962, 10.7348], [3.573, 11.3272], [3.6126, 11.6606],
  [3.681, 12.5526], [3.969, 12.9554], [4.1094, 13.5309], [4.3686, 13.7475], [5.4415, 13.866],
  [6.4459, 13.492], [6.8203, 13.1145], [7.3315, 13.0976], [7.8031, 13.343], [9.0163, 12.8268],
  [9.5239, 12.8505], [10.1143, 13.277], [10.7011, 13.2465], [10.9891, 13.387], [11.5291, 13.3295],
  [12.3031, 13.0367], [13.0843, 13.5969], [13.3183, 13.5563], [13.9951, 12.4612], [14.1823, 12.4832],
  [14.5783, 12.0854], [14.4667, 11.9043], [14.4163, 11.5726], [13.5739, 10.7991], [13.3075, 10.161],
  [13.1671, 9.6414], [12.9547, 9.418], [12.7531, 8.7173], [12.2203, 8.306], [12.0655, 7.7999],
  [11.8387, 7.3971], [11.7451, 6.9807], [11.0575, 6.6439], [10.4959, 7.0552], [10.1179, 7.0382],
  [9.5239, 6.4543], [9.2323, 6.4441], [8.7571, 5.4794], [8.5015, 4.7719], [7.4611, 4.4114],
  [7.0831, 4.4639], [6.6979, 4.2404], [5.8987, 4.2624], [5.3623, 4.8887], [5.0347, 5.6114],
  [4.3254, 6.2698], [3.573, 6.258], [2.691, 6.2597],
] as const;

/* RULING 30: the bbox the PMTiles extract was cut with, hardcoded rather than derived from a
 * downloaded outline. `west, south, east, north`, which is also MapLibre's `LngLatBoundsLike`
 * tuple order and the order `pmtiles extract --bbox` takes, so the one constant serves the map's
 * `fitBounds` and documents how to rebuild the asset (spec §8.3):
 *
 *   pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles nigeria.pmtiles \
 *     --bbox=2.5,3.9,15.0,14.1 --maxzoom=<ceiling>
 *
 * It is DELIBERATELY WIDER than NIGERIA_RING's own extent (2.691,4.2404 - 14.5783,13.866):
 * these are the tile bounds, and a tile set cut flush to the border would leave the coastline
 * and the Lake Chad shore with nothing beyond them. `fitNation` used `d3.geoBounds(NG)` - the
 * ring's extent - so FIT_BOUNDS below, not this, is what frames the map. */
export const EXTRACT_BBOX = [2.5, 3.9, 15.0, 14.1] as const;

/** `d3.geoBounds(NG)` as the original computed it (prototype line 650), from NIGERIA_RING. */
export const FIT_BOUNDS: readonly [[number, number], [number, number]] = (() => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lon, lat] of NIGERIA_RING) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [[w, s], [e, n]];
})();
