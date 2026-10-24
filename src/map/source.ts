/* The spot source: what goes into MapLibre's `geojson` source, and when.
 *
 * THE SOURCE CARRIES ALL 441 FEATURES, ALWAYS. Filtering is `setFilter` on the layers
 * (`spotFilter` in expressions.ts), not a smaller source, which is the whole reason the
 * original's `clearLayers()` / `addData()` cycle disappears. The only thing that ever calls
 * `setData` again is a zoom-bucket change, because ruling 9's exaggeration is a geometry
 * transform and cannot be a paint property.
 *
 * `lst_rel` IS COMPUTED HERE AND INJECTED AS A PROPERTY, so the fill expression can be a plain
 * `['get', 'lst_rel']` evaluated on the GPU. `encodeValue` needs a Map of reference means, which
 * no expression can hold, so the join happens in JS once - at load - rather than per frame.
 */

import { buildReferenceMeans, encodeValue } from '../lib/encode.mjs';
import type { SpotFeature, Spots } from '../app/data';
import { LEVEL_ORDER, exaggerate } from './exaggerate';

/**
 * REFERENCE MEANS COME FROM THE UNFILTERED FEATURE SET, ONCE, AT LOAD.
 *
 * Both halves of that are load-bearing and both are easy to break in good faith.
 *
 * UNFILTERED: a reference mean is "the mean `mean_lst` over this city's L50 contours for this
 * period" (spec §6.1). Computing it from whatever the reader has filtered to would make the
 * colour of a polygon depend on which OTHER polygons are on screen - pick a cluster and every
 * remaining spot changes colour, with nothing on screen to say why. Worse, filter to L75 or L90
 * and `buildReferenceMeans` - which reads L50 rows only - returns an EMPTY map, so every spot's
 * `lst_rel` becomes null and the entire map renders at `--neutral-mid`. `source.test.ts` pins
 * exactly that difference.
 *
 * ONCE: the join is 441 features against a 110-entry map, cheap on its own but on the path of
 * every zoom-bucket `setData`. The cache is keyed on the `Spots` OBJECT, so it is per loaded
 * dataset rather than per call, and a `WeakMap` means it does not outlive the data.
 */
const REFS = new WeakMap<Spots, Map<string, number>>();

export function spotReferenceMeans(spots: Spots): Map<string, number> {
  const hit = REFS.get(spots);
  if (hit) return hit;
  // The whole feature array. Not a filtered slice, ever - see above.
  const refs = buildReferenceMeans(spots.features);
  REFS.set(spots, refs);
  return refs;
}

export interface SpotSource {
  readonly type: 'FeatureCollection';
  readonly features: readonly SpotFeature[];
}

/**
 * The 441 features with `lst_rel` injected, sorted into draw order, geometry scaled by `factor`.
 *
 * DRAW ORDER IS L50 -> L75 -> L90 (prototype line 695). Within one MapLibre layer, features
 * paint in source order, so the sort is what puts the small dark L90 core on top of the pale L50
 * ring it sits inside. Sorting at the source instead of per render is the other half of what the
 * original did on every tick.
 *
 * `lst_rel` IS `null`, NEVER `undefined`, for the 2 of 441 features that have no reference mean -
 * `encodeValue`'s own contract - because the fill expression tests `['==', ['get','lst_rel'],
 * null]` and that is the value it is looking for.
 */
export function spotFeatures(spots: Spots, factor: number): SpotFeature[] {
  const refs = spotReferenceMeans(spots);
  return spots.features
    .map((f) => ({
      type: 'Feature' as const,
      properties: { ...f.properties, lst_rel: encodeValue(f.properties, refs) },
      geometry: exaggerate(f.geometry, factor),
    }))
    .sort((a, b) => LEVEL_ORDER[a.properties.contour_level] - LEVEL_ORDER[b.properties.contour_level]);
}

export function spotSource(spots: Spots, factor: number): SpotSource {
  return { type: 'FeatureCollection', features: spotFeatures(spots, factor) };
}
