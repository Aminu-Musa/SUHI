/* NIGERIA'S FIRST-LEVEL ADMINISTRATIVE BOUNDARIES - 36 states plus the Federal Capital
 * Territory, from `data/boundaries/nga-adm1.topojson`.
 *
 * ══ WHY THIS FILE EXISTS, AND WHAT IT REPLACES ══
 *
 * §9.1 bug 6 was a `d3.geoGraticule` at 1.6 degree steps whose extent was Nigeria's bounding
 * RECTANGLE: "state lines" that ran over Niger, Cameroon, Benin and the Bight of Benin. The
 * user's 2026-10-24 reversal of ruling 31 replaced it with the vector basemap's own
 * admin-level-1 lines (`boundaries`, `kind: 'region'`), which fixed the graticule but not the
 * extent: those features carry NO country code, name or ISO field at any zoom in the extract, so
 * there is nothing to filter on and Niger's, Benin's, Cameroon's and Chad's first-level divisions
 * render inside the bbox too. That is visible in `shot-task6-*.png` and it was reported rather
 * than worked around, because a clip would have been the invented substitute the reversal moved
 * away from.
 *
 * This file is the real answer. It is NIGERIA-ONLY BY CONSTRUCTION: 37 features, every one
 * `shapeGroup: NGA`, asserted below and in `boundaries.test.ts` against the shipped bytes. There
 * is no filter to get wrong because there is nothing else in the file.
 *
 * THE NATIONAL OUTLINE STAYS ON THE BASEMAP (ruling 30). Only the state layer moves. The two
 * answer different questions - a state line is a real boundary but it is not the border - and
 * ruling 30 chose the basemap's own `kind: 'country'` line deliberately, at the 2px
 * `--ui-line-strong` the original gave its world-atlas outline. Drawing both from this file
 * would mean dissolving 37 polygons into one at runtime, for an outline that is already correct.
 *
 * ══ TOPOJSON, FETCHED, NOT IMPORTED ══
 *
 * 260 KB of topology that expands to roughly a megabyte of GeoJSON. `import`ing it would put the
 * expanded form in the entry chunk - the regression Task 12 spent its first commit undoing - so
 * it is fetched at runtime beside the four data files, resolved the same way they are
 * (`document.baseURI`, see src/app/data.ts for why not `import.meta.url`), and converted here.
 *
 * PROVENANCE: geoBoundaries gbOpen ADM1, ODC-ODbL, 2025-08-26. It is NOT GRID3's own layer -
 * see data/boundaries/README.md, which records why and what swapping GRID3 in would cost.
 */

import { feature } from 'topojson-client';

/** The source id the style declares and `setData` addresses. Not the basemap's `boundaries`. */
export const STATES_SOURCE = 'states-adm1';

/** Relative to the PAGE, exactly as `DATA_URLS` are, so the fidelity harness and the production
 * site resolve it to the same place without a copy to keep in step. */
export const BOUNDARIES_URL = '../data/boundaries/nga-adm1.topojson';

/** 36 states plus the Federal Capital Territory. The rail's `states` chip reads `37` for this
 * reason (src/rail/Layers.tsx), so the two cannot drift silently. */
export const STATE_COUNT = 37;

/** geoBoundaries' ISO country code field. Every feature in this file carries `NGA`. */
export const COUNTRY_CODE = 'NGA';

/** ODC-ODbL requires attribution and share-alike, so this is a LICENCE CONDITION rather than a
 * courtesy - the one reason a third map host appears in a built style after rulings 29 and 30
 * went to the trouble of removing two. It rides on the source that carries the data, which is
 * how MapLibre's attribution control collects credits. */
export const STATES_ATTRIBUTION =
  '<a href="https://www.geoboundaries.org">geoBoundaries</a> (ODbL)';

export interface StateFeature {
  type: 'Feature';
  properties: { shapeName: string; shapeISO: string; shapeID: string; shapeGroup: string; shapeType: string };
  geometry: { type: string; coordinates: unknown };
}

export interface StateCollection {
  type: 'FeatureCollection';
  features: StateFeature[];
}

/** What the style declares before the fetch lands, and what it falls back to if the fetch fails.
 * A source with no data at all would make `setData` the only way the layer ever appears, and a
 * layer whose source is missing is a MapLibre error rather than an empty map. */
export const EMPTY_STATES: StateCollection = { type: 'FeatureCollection', features: [] };

/**
 * TopoJSON to GeoJSON, with the file's own promises checked rather than assumed.
 *
 * Every throw here is a fact about the bytes, not defensiveness: this is the only place that
 * knows the file is Nigeria-only, and a silent pass would put a neighbour's divisions back on the
 * map through a different door. The caller turns a throw into an empty layer and a console
 * warning - a missing state layer is a visible absence, where wrong state lines are not.
 */
export function statesFrom(topo: unknown): StateCollection {
  const objects = (topo as { objects?: Record<string, unknown> } | null)?.objects;
  if (!objects) throw new Error('nga-adm1.topojson: no `objects` member - not a topology');
  const keys = Object.keys(objects);
  /* ONE object, and the key is NOT hard-coded. It is `NGAADM1gbOpen` today, which is a
   * geoBoundaries release name; pinning it would make a re-export with a different label look
   * like a missing file. The COUNT is pinned instead, which is the property that matters. */
  if (keys.length !== 1) throw new Error(`nga-adm1.topojson: expected one object, found ${keys.length}`);
  const fc = feature(topo, objects[keys[0]]) as StateCollection;
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('nga-adm1.topojson: the object is not a GeometryCollection');
  }
  if (fc.features.length !== STATE_COUNT) {
    throw new Error(`nga-adm1.topojson: expected ${STATE_COUNT} features, found ${fc.features.length}`);
  }
  const foreign = fc.features.filter((f) => f.properties?.shapeGroup !== COUNTRY_CODE);
  if (foreign.length) {
    throw new Error(
      `nga-adm1.topojson: ${foreign.length} feature(s) are not ${COUNTRY_CODE} - the whole point of this file is that none are`,
    );
  }
  return fc;
}

/** Fetches and converts. Rejects on an HTTP error with the path in the message, like
 * `loadSuhiData` does, because "the state layer is empty" is otherwise unattributable. */
export async function loadStateBoundaries(base: string = document.baseURI): Promise<StateCollection> {
  const url = new URL(BOUNDARIES_URL, base);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.pathname}: HTTP ${res.status}`);
  return statesFrom(await res.json());
}
