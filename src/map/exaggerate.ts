/* RULING 9 - the geometry exaggeration, reproduced exactly. Prototype lines 706-721.
 *
 * WHY THIS IS NOT A LEAFLET WORKAROUND TO DELETE. A median spot is 12.7 km2 - about 3 px across
 * at national zoom. The original does not substitute a symbol for it; it scales the REAL
 * geometry about each polygon's own centroid, so the shape, the nesting and the colour all stay
 * true and only the size is exaggerated. And it says so on screen: `#zoomHint` discloses the
 * factor through `hint_zoom` / `hint_true`, strings that exist in all four languages
 * (dictionary lines 136-140). The `exag` layer toggle switches it off. It is a disclosed design
 * decision, and removing it would ship an effectively empty map at the default view.
 *
 * WHY IT STAYS A GEOMETRY TRANSFORM. MapLibre has no paint property that scales a polygon about
 * its centroid. `fill-outline-width` does not exist, a thicker stroke moves the edge by a fixed
 * number of pixels rather than scaling the shape, and `circle-radius` would be the symbol
 * substitution the original deliberately refused. So this runs in JS and the result goes in
 * through `source.setData()`.
 *
 * WHAT CHANGED FROM THE ORIGINAL IS WHEN IT RUNS, NOT WHAT IT COMPUTES. The original re-walked
 * every coordinate on every `zoomend`, every filter change and every year-slider tick, then tore
 * down and rebuilt both Leaflet layers (`clearLayers()` / `addData()`, lines 722-737). Here the
 * factor changes only on a ZOOM-BUCKET change - five discrete buckets - so a pan, a filter, the
 * opacity slider and the year slider never touch geometry at all.
 *
 * THE BUCKET IS `Math.floor(zoom)`, AND THAT IS THE FAITHFUL READING. The original indexed
 * `EXAG[map.getZoom()]`, which only ever hit because Leaflet's default `zoomSnap: 1` makes
 * `getZoom()` an integer; `fitBounds` picks the largest integer zoom that fits, i.e. the floor
 * of the fractional fit zoom. MapLibre's zoom is continuous, so flooring it reproduces which
 * bucket the original would have been in - whereas indexing the raw fractional zoom would miss
 * every key and silently return 1, which is the empty map ruling 9 exists to prevent.
 */

/** Prototype line 715, verbatim. Any zoom not listed is 1 - "no exaggeration". */
export const EXAG: Readonly<Record<number, number>> = { 5: 9, 6: 6, 7: 4, 8: 2.2 };

/** `L50` outermost, `L90` innermost - the draw order the nesting depends on (line 695). */
export const LEVEL_ORDER: Readonly<Record<string, number>> = { L50: 0, L75: 1, L90: 2 };

/** The zoom bucket a continuous zoom falls in. Five values: 5, 6, 7, 8 and "above 8". */
export function exagBucket(zoom: number): number {
  return Math.floor(zoom);
}

/** Prototype line 716 (`exagFactor`), with the bucket made explicit. `on` is `state.layers.exag`. */
export function exagFactor(zoom: number, on = true): number {
  if (!on) return 1;
  return EXAG[exagBucket(zoom)] ?? 1;
}

type Ring = unknown;

export interface Geom {
  readonly type: string;
  readonly coordinates: Ring;
}

/**
 * Prototype lines 706-708, including its two quirks, because "exactly" means exactly.
 *
 *   - It returns `[lat, lon]`, not `[lon, lat]`. The original's own `exaggerate` destructures it
 *     that way, so the pair is self-consistent; nothing else reads it.
 *   - It is the UNWEIGHTED MEAN OF EVERY COORDINATE PAIR in the geometry, not an area centroid:
 *     ring-closing duplicates are counted twice, a hole pulls the centre towards itself, and a
 *     MultiPolygon's parts are weighted by vertex count rather than by area. A true centroid
 *     would move some polygons visibly relative to the approved render, which spec §3 makes the
 *     authority. Do not "fix" this.
 */
export function centroid(g: Geom): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  const walk = (a: unknown): void => {
    const arr = a as unknown[];
    if (Array.isArray(arr[0])) {
      for (const inner of arr) walk(inner);
      return;
    }
    x += arr[0] as number;
    y += arr[1] as number;
    n += 1;
  };
  walk(g.coordinates);
  return [y / n, x / n];
}

/** Prototype lines 717-721: scale every vertex away from the centroid by `k`. `k <= 1` is the
 * identity, and returns the SAME object so an un-exaggerated render costs no allocation. */
export function exaggerate<T extends Geom>(g: T, k: number): T {
  if (k <= 1) return g;
  const [lat, lon] = centroid(g);
  const walk = (a: unknown): unknown => {
    const arr = a as unknown[];
    if (Array.isArray(arr[0])) return arr.map(walk);
    return [lon + ((arr[0] as number) - lon) * k, lat + ((arr[1] as number) - lat) * k];
  };
  return { type: g.type, coordinates: walk(g.coordinates) } as T;
}
