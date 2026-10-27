/* The ADM1 boundaries, against the SHIPPED BYTES.
 *
 * `data/boundaries/nga-adm1.topojson?raw` rather than a hand-written topology, for the reason
 * `src/rail/fixtures.ts` gives: the claim these tests make is that the FILE in this repository is
 * Nigeria-only, and a synthetic fixture could be made to say whatever the test wanted. The whole
 * value of this change over the basemap's own admin lines is a property of the file.
 */

import { expect, test } from 'vitest';
import raw from '../../data/boundaries/nga-adm1.topojson?raw';
import {
  BOUNDARIES_URL,
  COUNTRY_CODE,
  EMPTY_STATES,
  STATES_SOURCE,
  STATE_COUNT,
  statesFrom,
  type StateCollection,
} from './boundaries';

/* `?raw` returns an EMPTY STRING when `test.css` is off (the README's own lesson, measured on an
 * 18,087-character stylesheet that a test read as nothing and passed). So the first thing
 * asserted is that this suite read a file at all. */
test('the fixture is the real 260 KB topology, not an empty ?raw read', () => {
  expect(raw.length).toBeGreaterThan(200_000);
  expect(raw.slice(0, 40)).toContain('Topology');
});

const topo = JSON.parse(raw) as unknown;
const states = statesFrom(topo);

test('37 features: 36 states plus the Federal Capital Territory', () => {
  expect(states.type).toBe('FeatureCollection');
  expect(states.features).toHaveLength(STATE_COUNT);
  expect(STATE_COUNT).toBe(37);
  // The rail's `states` chip reads `37` (src/rail/Layers.tsx); this is the number it claims.
  const names = states.features.map((f) => f.properties.shapeName);
  expect(new Set(names).size, 'two features share a shapeName').toBe(STATE_COUNT);
  /* geoBoundaries calls it 'Abuja Federal Capital Territory', which is the 37th feature and the
   * reason this is 37 rather than 36. Asserted by its own name rather than by the count alone:
   * a file of 37 STATES with the FCT missing would satisfy every number above. */
  expect(names).toContain('Abuja Federal Capital Territory');
  expect(names).toContain('Lagos');
  expect(names).toContain('Kano');
  // The four countries whose divisions the basemap's own admin layer let in.
  expect(names.filter((n) => /Zinder|Diffa|Maradi|Extr[eê]me/.test(n))).toEqual([]);
});

test('EVERY feature is Nigerian, which is the entire reason this file replaced the basemap`s', () => {
  /* §9.1 bug 6's third and final state. The graticule ran over four countries; the basemap's own
   * admin lines carried no country field at any zoom, so Niger's, Benin's, Cameroon's and Chad's
   * divisions rendered inside the bbox (visible in shot-task6-*.png). There is nothing to filter
   * here because there is nothing foreign in the file. */
  expect(states.features.every((f) => f.properties.shapeGroup === COUNTRY_CODE)).toBe(true);
  expect(COUNTRY_CODE).toBe('NGA');
  expect(new Set(states.features.map((f) => f.properties.shapeGroup))).toEqual(new Set(['NGA']));
  expect(new Set(states.features.map((f) => f.properties.shapeType))).toEqual(new Set(['ADM1']));
});

test('every geometry is a real polygon inside Nigeria`s envelope', () => {
  /* A topology that converted to 37 empty features would satisfy every count above. The envelope
   * is EXTRACT_BBOX's, which is the basemap's own and the one `fitNation` frames. */
  const [W, S, E, N] = [2.5, 3.9, 15.0, 14.1];
  let points = 0;
  /* COLLECTED, not asserted per vertex. An `expect` per coordinate over ~150,000 of them cost
   * 6 s on its own (measured) and reports the same one fact; this reports the count as well,
   * which is more useful when it fails. */
  const outside: string[] = [];
  const visit = (a: unknown): void => {
    const arr = a as unknown[];
    if (!Array.isArray(arr)) return;
    if (Array.isArray(arr[0])) {
      for (const inner of arr) visit(inner);
      return;
    }
    const [lon, lat] = arr as number[];
    points += 1;
    if (lon < W || lon > E || lat < S || lat > N) outside.push(`${lon},${lat}`);
  };
  for (const f of states.features) {
    expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
    visit(f.geometry.coordinates);
  }
  expect(points, 'the conversion produced no coordinates at all').toBeGreaterThan(5_000);
  expect(outside.slice(0, 5), `${outside.length} vertices fall outside Nigeria`).toEqual([]);
});

test('`statesFrom` REFUSES anything that is not 37 Nigerian features', () => {
  /* The guarantee the style no longer carries a filter for. Each of these is a way the file
   * could change under us - a re-export, a different country's bundle, a partial download - and
   * each has to be a throw rather than a thinner map. */
  expect(() => statesFrom(null)).toThrow(/no `objects`/);
  expect(() => statesFrom({ objects: {} })).toThrow(/expected one object/);
  expect(() => statesFrom({ objects: { a: {}, b: {} } })).toThrow(/expected one object/);

  const trimmed = structuredClone(topo) as { objects: Record<string, { geometries: unknown[] }> };
  const key = Object.keys(trimmed.objects)[0];
  trimmed.objects[key].geometries = trimmed.objects[key].geometries.slice(0, 36);
  expect(() => statesFrom(trimmed)).toThrow(/expected 37 features, found 36/);

  const foreign = structuredClone(topo) as {
    objects: Record<string, { geometries: { properties: { shapeGroup: string } }[] }>;
  };
  foreign.objects[key].geometries[0].properties.shapeGroup = 'NER';
  expect(() => statesFrom(foreign)).toThrow(/1 feature\(s\) are not NGA/);
});

test('the source id is not the basemap`s `boundaries`, and the URL resolves like the data files', () => {
  /* Two different sources now draw the two boundary layers: the state lines come from this file
   * and the national outline stays on the basemap (ruling 30). An id collision would silently
   * give the states layer the basemap's vector tiles back. */
  expect(STATES_SOURCE).not.toBe('basemap');
  expect(STATES_SOURCE).not.toBe('boundaries');
  /* Relative to the PAGE, exactly as `DATA_URLS` are: `/dist/index.html` and
   * `/project/nigeria-suhi-dashboard.html` both resolve it to the repository's own copy, with no
   * duplicate to keep in step - which is §9.1 bug 9's lesson. */
  expect(BOUNDARIES_URL.startsWith('../data/')).toBe(true);
  expect(new URL(BOUNDARIES_URL, 'http://127.0.0.1:5179/dist/index.html').pathname).toBe(
    '/data/boundaries/nga-adm1.topojson',
  );
});

test('the empty collection the style declares is empty, and is not the loaded one', () => {
  expect(EMPTY_STATES.features).toEqual([]);
  // A shared mutable default would let `setData` leak the real geometry into the style object.
  expect((EMPTY_STATES as StateCollection).features).not.toBe(states.features);
});
