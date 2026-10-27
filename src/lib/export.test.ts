// @vitest-environment jsdom
/* `buildExport` and the encoders, against the REAL data files.
 *
 * jsdom rather than node, because the subject produces `Blob`s and reads their bytes back.
 *
 * Several names below carry the REASON for the behaviour they pin. The encoding tests in
 * particular are about bytes, not about strings: a test that compares `blob.text()` to a
 * JavaScript literal compares two UTF-16 strings and would pass over any encoding bug at all,
 * because the mojibake would be introduced by the READER, not by us (§9.1 bug 1, retracted, is
 * exactly that mistake made once already). So they decode the bytes explicitly.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { FIXTURE } from '../rail/fixtures';
import {
  EXPORT_OPTIONS,
  buildExport,
  cityAggregateRows,
  contourGeoJson,
  contourTopoJson,
  csvField,
  csvText,
  filterCityRows,
  filterSpotFeatures,
  saveBlob,
  spotRecordRows,
  type ExportFilters,
} from './export';

const DEFAULTS: ExportFilters = { contour: 'all', cluster: 'all', year: 2024, city: null };
const f = (over: Partial<ExportFilters> = {}): ExportFilters => ({ ...DEFAULTS, ...over });

const DATA = { cities: FIXTURE.cities, clusters: FIXTURE.clusters, spots: FIXTURE.spots };

const bytes = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());
/** The bytes decoded as UTF-8, BOM stripped. The decode is the point: see the header note. */
const utf8 = async (b: Blob): Promise<string> =>
  new TextDecoder('utf-8', { fatal: true }).decode(await bytes(b)).replace(/^﻿/, '');
const hex = (u: Uint8Array): string => [...u].map((n) => n.toString(16).padStart(2, '0')).join(' ');
/** RFC 4180 rows. Enough for these fixtures: no exported field contains a CRLF. */
const rowsOf = (text: string): string[] => text.replace(/\r\n$/, '').split('\r\n');

describe('the six options', () => {
  test('the labels and descriptions are the original copy, verbatim (prototype 1157-1163)', () => {
    expect(EXPORT_OPTIONS.map((o) => [o.label, o.desc])).toEqual([
      ['City brief (PDF)', 'One page per selected city.'],
      ['Full report (PDF)', 'All 55 cities with national summary.'],
      ['Spot records (CSV)', '441 rows · 30 fields.'],
      ['Contours (GeoJSON)', 'EPSG:4326, current view.'],
      ['Contours (TopoJSON)', 'Compact geometry for the web.'],
      ['City aggregates (CSV)', '55 rows.'],
    ]);
  });

  test('exactly the two PDF options are print, and they build no Blob', () => {
    expect(EXPORT_OPTIONS.filter((o) => o.kind === 'print').map((o) => o.value)).toEqual([
      'city-brief-pdf',
      'full-report-pdf',
    ]);
    // Ruling 40's honest reading: no PDF library, so these two are window.print().
    expect(buildExport('city-brief-pdf', DATA, f())).toBeNull();
    expect(buildExport('full-report-pdf', DATA, f())).toBeNull();
  });

  test('every download option names a filename and a mime type', () => {
    for (const o of EXPORT_OPTIONS.filter((x) => x.kind === 'download')) {
      expect(o.filename, o.label).toMatch(/\.(csv|geojson|topojson)$/);
      expect(o.mime, o.label).toBeTruthy();
    }
  });
});

describe('csvField and csvText', () => {
  test('CSV quotes a field containing a comma', () => {
    expect(csvField('Tropical wet and dry, inland')).toBe('"Tropical wet and dry, inland"');
    // and leaves one that does not need it alone, so quoting is not blanket
    expect(csvField('Grassland')).toBe('Grassland');
  });

  test('an internal double quote is doubled and the field quoted (RFC 4180)', () => {
    expect(csvField('a "quoted" word')).toBe('"a ""quoted"" word"');
  });

  test('a newline or carriage return forces quoting, so a row cannot be split in two', () => {
    expect(csvField('one\ntwo')).toBe('"one\ntwo"');
    expect(csvField('one\rtwo')).toBe('"one\rtwo"');
  });

  test('null and undefined become empty, not the strings "null" and "undefined"', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  test('csvText writes the header then one CRLF-terminated row per record', () => {
    const text = csvText(['a', 'b'], [{ a: 1, b: 'x,y' }, { a: 2, b: 'z' }]);
    expect(text).toBe('a,b\r\n1,"x,y"\r\n2,z\r\n');
  });

  test('csvText itself emits NO BOM, so the string stays a plain parseable CSV', () => {
    expect(csvText(['a'], [{ a: 1 }]).startsWith('﻿')).toBe(false);
  });
});

describe('CSV is UTF-8 with diacritics intact', () => {
  test('a Yorùbá string survives the Blob as UTF-8 bytes, not as cp1252 mojibake', async () => {
    const blob = new Blob([csvText(['lang'], [{ lang: 'Yorùbá' }])], { type: 'text/csv;charset=utf-8' });
    const raw = await bytes(blob);
    // ù is c3 b9 and á is c3 a1 in UTF-8. Asserting the BYTES, because comparing decoded
    // strings would pass even if the encoding were wrong.
    expect(hex(raw)).toContain('c3 b9');
    expect(hex(raw)).toContain('c3 a1');
    expect(await utf8(blob)).toContain('Yorùbá');
  });

  test('the typology EN DASH round-trips through the real city aggregates export as e2 80 93', async () => {
    /* `101–500 m` is a REAL string in clusters.json - and the one §9.1 bug 1 was wrongly
     * reported as mojibake because a Windows console mangled the display. The file is valid
     * UTF-8; this asserts our export keeps it that way. */
    const blob = buildExport('city-aggregates-csv', DATA, f())!;
    const raw = await bytes(blob);
    expect(hex(raw)).toContain('e2 80 93');
    const text = await utf8(blob);
    expect(text).toContain('101–500 m');
    // The middle dot in `Grassland · 101–500 m · Metamorphic` is c2 b7, the other half of bug 1.
    expect(hex(raw)).toContain('c2 b7');
    expect(text).toContain(' · ');
  });

  test('a CSV blob carries the UTF-8 BOM, which is what keeps Excel on Windows from cp1252', async () => {
    for (const v of ['spot-records-csv', 'city-aggregates-csv'] as const) {
      const raw = await bytes(buildExport(v, DATA, f())!);
      expect(hex(raw.slice(0, 3)), v).toBe('ef bb bf');
    }
  });

  test('every CSV byte sequence is strictly valid UTF-8', async () => {
    // `fatal: true` makes the decoder THROW on an ill-formed sequence rather than substituting
    // U+FFFD, so this is a real assertion about the bytes and not about the decoder's charity.
    for (const v of ['spot-records-csv', 'city-aggregates-csv'] as const) {
      await expect(utf8(buildExport(v, DATA, f())!)).resolves.toBeTruthy();
    }
  });

  test('a typology field containing a comma would be quoted - the join is not trusted to be safe', () => {
    const { columns, rows } = cityAggregateRows(
      [{ ...FIXTURE.cities[0], cluster: 999 }],
      [{ ...FIXTURE.clusters[0], id: 999, typology: 'Cropland, mixed · 101–500 m' }],
      f(),
    );
    expect(csvText(columns, rows)).toContain('"Cropland, mixed · 101–500 m"');
  });
});

describe('the exports carry the active filters', () => {
  test('the unfiltered spot export is all 441 records', () => {
    expect(FIXTURE.spots.features).toHaveLength(441);
    expect(filterSpotFeatures(FIXTURE.spots, f())).toHaveLength(441);
  });

  test('a contour level narrows the records to that level and nothing else', () => {
    const l90 = filterSpotFeatures(FIXTURE.spots, f({ contour: 'L90' }));
    expect(l90.length).toBeGreaterThan(0);
    expect(l90.length).toBeLessThan(441);
    expect(new Set(l90.map((x) => x.properties.contour_level))).toEqual(new Set(['L90']));
  });

  test('a cluster narrows the records to that cluster', () => {
    const nine = filterSpotFeatures(FIXTURE.spots, f({ cluster: '9' }));
    expect(nine.length).toBeGreaterThan(0);
    expect(new Set(nine.map((x) => String(x.properties.cluster25)))).toEqual(new Set(['9']));
  });

  test('the city scope narrows the records, which is what "current view" on the card means', () => {
    const kano = filterSpotFeatures(FIXTURE.spots, f({ city: 'Kano' }));
    expect(kano.length).toBeGreaterThan(0);
    expect(new Set(kano.map((x) => x.properties.city))).toEqual(new Set(['Kano']));
  });

  test('contour and cluster compose rather than override one another', () => {
    const both = filterSpotFeatures(FIXTURE.spots, f({ contour: 'L50', cluster: '9' }));
    expect(both.length).toBeGreaterThan(0);
    for (const x of both) {
      expect(x.properties.contour_level).toBe('L50');
      expect(String(x.properties.cluster25)).toBe('9');
    }
  });

  test('the three filters reach the CSV as columns, so a file can say what produced it', () => {
    const { columns, rows } = spotRecordRows(FIXTURE.spots, f({ contour: 'L75', cluster: '9', year: 2015 }));
    expect(columns).toContain('contour_filter');
    expect(columns).toContain('cluster_filter');
    expect(columns).toContain('year');
    expect(rows[0].contour_filter).toBe('L75');
    expect(rows[0].cluster_filter).toBe('9');
    expect(rows[0].year).toBe(2015);
  });

  test('the YEAR back-casts suhii with the Sen slope, because no record has a year field', () => {
    /* The corpus is the 2024 composite and the slider back-casts from it (prototype line 704).
     * An export that dropped the slider would be the one real lie available here. */
    const feat = FIXTURE.spots.features.find((x) => x.properties.sen_slope_C_per_decade !== 0)!;
    const only = { type: 'FeatureCollection', features: [feat] } as typeof FIXTURE.spots;
    const at2024 = spotRecordRows(only, f({ year: 2024 })).rows[0];
    const at2015 = spotRecordRows(only, f({ year: 2015 })).rows[0];
    expect(at2024.suhii_year).toBeCloseTo(feat.properties.suhii, 2);
    expect(at2015.suhii_year).not.toBe(at2024.suhii_year);
    expect(at2015.suhii_year).toBeCloseTo(
      Math.round((feat.properties.suhii - 0.9 * feat.properties.sen_slope_C_per_decade) * 100) / 100,
      2,
    );
    // The untouched 2024 value is still there next to it, so nothing is lost.
    expect(at2015.suhii).toBe(feat.properties.suhii);
  });

  test('the column list comes from the source file, so a new attribute is not silently dropped', () => {
    const { columns } = spotRecordRows(FIXTURE.spots, f());
    const source = Object.keys(FIXTURE.spots.features[0].properties);
    expect(columns.slice(0, source.length)).toEqual(source);
    expect(source.length).toBe(31);
  });

  test('a filter that selects nothing produces a header-only CSV, not a crash', () => {
    const { columns, rows } = spotRecordRows(FIXTURE.spots, f({ city: 'Atlantis' }));
    expect(rows).toEqual([]);
    expect(csvText(columns, rows).trim()).toBe(columns.join(','));
  });
});

describe('city aggregates', () => {
  test('the unfiltered export is the 55 rows the card advertises', async () => {
    expect(filterCityRows(FIXTURE.cities, f())).toHaveLength(55);
    const text = await utf8(buildExport('city-aggregates-csv', DATA, f())!);
    expect(rowsOf(text)).toHaveLength(56); // header plus 55
  });

  test('a cluster narrows the rows and matches that cluster n_cities', () => {
    const nine = filterCityRows(FIXTURE.cities, f({ cluster: '9' }));
    const declared = FIXTURE.clusters.find((k) => k.id === 9)!.n_cities;
    expect(nine).toHaveLength(declared);
  });

  test('CONTOUR does not narrow the rows, because cities.json is an L50 aggregation already', () => {
    /* Not an oversight: there is no per-level variant of a city row to select (see the header
     * note in src/rail/stats.ts). The chosen level still travels, as a column. */
    const all = filterCityRows(FIXTURE.cities, f({ contour: 'all' }));
    const l90 = filterCityRows(FIXTURE.cities, f({ contour: 'L90' }));
    expect(l90).toHaveLength(all.length);
    const { rows } = cityAggregateRows(FIXTURE.cities, FIXTURE.clusters, f({ contour: 'L90' }));
    expect(rows[0].contour_filter).toBe('L90');
  });

  test('every row carries its cluster typology, joined from clusters.json', () => {
    const { rows } = cityAggregateRows(FIXTURE.cities, FIXTURE.clusters, f());
    for (const r of rows) expect(String(r.typology).length, String(r.city)).toBeGreaterThan(5);
    const ibadan = rows.find((r) => r.city === 'Ibadan')!;
    expect(ibadan.typology).toBe(FIXTURE.clusters.find((k) => k.id === 9)!.typology);
  });
});

describe('GeoJSON and TopoJSON', () => {
  test('GeoJSON export is valid and carries the filtered features only', () => {
    const fc = contourGeoJson(FIXTURE.spots, f({ contour: 'L50', cluster: '9' }));
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features.length).toBe(filterSpotFeatures(FIXTURE.spots, f({ contour: 'L50', cluster: '9' })).length);
    for (const feat of fc.features) {
      expect(feat.type).toBe('Feature');
      expect(feat.properties.contour_level).toBe('L50');
      expect(['Polygon', 'MultiPolygon']).toContain(feat.geometry.type);
      expect(Array.isArray(feat.geometry.coordinates)).toBe(true);
    }
  });

  test('it declares no crs member, which is how RFC 7946 says EPSG:4326', async () => {
    /* The card promises "EPSG:4326". RFC 7946 REMOVED the crs member and defines GeoJSON as
     * WGS 84, so writing one back in would be the non-conforming choice. */
    const parsed = JSON.parse(await utf8(buildExport('contours-geojson', DATA, f())!));
    expect(parsed.crs).toBeUndefined();
    // Coordinates are lon/lat degrees in Nigeria's envelope, which is the substance of the claim.
    const [lon, lat] = flattenFirst(parsed.features[0].geometry.coordinates);
    expect(lon).toBeGreaterThan(2);
    expect(lon).toBeLessThan(15);
    expect(lat).toBeGreaterThan(3);
    expect(lat).toBeLessThan(14);
  });

  test('the GeoJSON blob carries the active year on every feature', async () => {
    const parsed = JSON.parse(await utf8(buildExport('contours-geojson', DATA, f({ year: 2015 }))!));
    for (const feat of parsed.features) expect(feat.properties.year).toBe(2015);
  });

  test('TopoJSON is a Topology with shared arcs and a quantizing transform', () => {
    const topo = contourTopoJson(FIXTURE.spots, f({ contour: 'L90' })) as {
      type: string;
      objects: Record<string, { type: string; geometries: unknown[] }>;
      arcs: unknown[];
      transform?: unknown;
    };
    expect(topo.type).toBe('Topology');
    expect(Object.keys(topo.objects)).toEqual(['contours']);
    expect(topo.objects.contours.type).toBe('GeometryCollection');
    expect(topo.objects.contours.geometries.length).toBe(
      filterSpotFeatures(FIXTURE.spots, f({ contour: 'L90' })).length,
    );
    expect(topo.arcs.length).toBeGreaterThan(0);
    // The transform is what "compact geometry for the web" buys; without it the arcs are floats.
    expect(topo.transform).toBeTruthy();
  });

  test('TopoJSON is smaller than the GeoJSON it came from, which is the whole claim on the card', async () => {
    const geo = (await bytes(buildExport('contours-geojson', DATA, f())!)).length;
    const topo = (await bytes(buildExport('contours-topojson', DATA, f())!)).length;
    expect(topo).toBeLessThan(geo);
  });
});

describe('buildExport and saveBlob', () => {
  test('each download format produces a non-empty Blob of its declared mime type', async () => {
    for (const o of EXPORT_OPTIONS.filter((x) => x.kind === 'download')) {
      const blob = buildExport(o.value, DATA, f())!;
      expect(blob, o.label).toBeInstanceOf(Blob);
      expect(blob.type, o.label).toBe(o.mime);
      expect((await bytes(blob)).length, o.label).toBeGreaterThan(100);
    }
  });

  test('an unknown format string returns null instead of throwing', () => {
    expect(buildExport('nope' as never, DATA, f())).toBeNull();
  });

  describe('saveBlob', () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const clicked: { href: string; download: string }[] = [];

    afterEach(() => {
      created.length = revoked.length = clicked.length = 0;
      // @ts-expect-error jsdom has no object-URL support; the stubs are installed per test.
      delete URL.createObjectURL;
      // @ts-expect-error see above
      delete URL.revokeObjectURL;
    });

    test('it anchors the blob, names the file, clicks once and revokes the URL', async () => {
      URL.createObjectURL = (b: Blob) => {
        const u = `blob:stub/${created.length}/${b.size}`;
        created.push(u);
        return u;
      };
      URL.revokeObjectURL = (u: string) => void revoked.push(u);
      const proto = HTMLAnchorElement.prototype as unknown as { click: () => void };
      const realClick = proto.click;
      proto.click = function (this: HTMLAnchorElement) {
        clicked.push({ href: this.href, download: this.download });
      };
      try {
        saveBlob(new Blob(['x,y\r\n'], { type: 'text/csv' }), 'suhi-test.csv');
      } finally {
        proto.click = realClick;
      }
      expect(created).toHaveLength(1);
      expect(clicked).toHaveLength(1);
      expect(clicked[0].download).toBe('suhi-test.csv');
      expect(clicked[0].href).toBe(created[0]);
      // The anchor is removed again, so a download never leaves a node behind.
      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
      // Revoked on a macrotask, not in the click's own tick - Safari aborts the download if the
      // object URL dies synchronously.
      expect(revoked).toEqual([]);
      await new Promise((r) => setTimeout(r, 1));
      expect(revoked).toEqual(created);
    });
  });
});

/** First coordinate pair of an arbitrarily nested ring array. */
function flattenFirst(coords: unknown): [number, number] {
  let c = coords;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return c as [number, number];
}
