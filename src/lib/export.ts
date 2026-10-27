/* Data export for the Reports tab — RULING 40, written from scratch.
 *
 * THE ORIGINAL'S EXPORT BUTTONS HAVE NEVER WORKED. `renderReport` (prototype lines 1151-1168)
 * builds six `.card2` cards each ending in `<button class="ghost">Download</button>` and binds
 * nothing to any of them: there is no `Blob`, no `createObjectURL`, no CSV and no GeoJSON code
 * anywhere in the file's 1,179 lines. So none of this is transcription.
 *
 * It is in scope rather than a new feature because the cards advertise concrete deliverables —
 * "441 rows · 30 fields", "EPSG:4326, current view" — and §7.7's lede promises "the underlying
 * records for analysis". That is a promise the UI makes and does not keep, which is nearer §9.1
 * bug 7 (a tile whose `.val` was missing) than it is to a deep-link feature.
 *
 * NO PDF LIBRARY. Two of the six options say PDF, and jsPDF or pdfmake is 300-400 KB of
 * dependency for them — on a page whose own data payload is the thing that should be large.
 * `window.print()` with Task 11's print stylesheet is the honest reading of "City brief (PDF)"
 * and "Full report (PDF)": every browser's print dialog has "Save as PDF", the output carries
 * the page's own type and tokens, and nothing has to be laid out twice. The two options are
 * therefore `kind: 'print'` below and produce no Blob — `buildExport` returns null for them,
 * which is a documented, tested outcome rather than a silent no-op.
 *
 * EXPORTS CARRY THE ACTIVE FILTERS, which is what the original's own note on screen says:
 * contour level, cluster and year. Contour and cluster are row filters. The YEAR is not: no
 * record in the dataset has a year field, because the whole corpus is the 2024 composite and
 * the slider back-casts from it with each record's Sen slope (prototype line 704, `spotValue`).
 * So the year reaches the export the only way it can — as a `year` column and a `suhii_year`
 * column holding the back-cast value, next to the untouched 2024 `suhii`. An export that
 * silently dropped the slider would be the one real lie available here.
 *
 * THE CITY SCOPE travels too, although the note names only three filters. A reader who has
 * scoped to Kano and asks for "Contours (GeoJSON) · EPSG:4326, current view" is asking for
 * Kano. The note is the original's copy and is left verbatim; this is the behaviour the words
 * "current view" describe.
 *
 * CSV ENCODING. `csvText` quotes a field containing a comma, a double quote, a newline or a
 * carriage return, and doubles internal quotes (RFC 4180). The Blob is UTF-8 with a BOM: the
 * clusters typology strings carry `·` and an EN DASH (`101–500 m`, bytes e2 80 93) and city
 * strings carry diacritics, and an export is the one place this data leaves our fonts and our
 * charset declaration. Excel on Windows reads a BOM-less UTF-8 CSV as cp1252 and renders
 * `101â€“500 m`, so the three BOM bytes are the difference between the data surviving and not.
 * `csvText` itself returns no BOM, so the string stays a parseable CSV for any other consumer.
 *
 * (The clusters file's typology strings are VALID UTF-8 — §9.1 bug 1, retracted. Do not
 * "fix" them.)
 */

import { topology } from 'topojson-server';
import type { City, Cluster, SpotFeature, Spots } from '../app/data';
import type { Contour, State } from '../app/state';
import { spotValue } from '../rail/stats';

/** The six options, label and description VERBATIM from prototype lines 1157-1163. */
export type ExportFormat =
  | 'city-brief-pdf'
  | 'full-report-pdf'
  | 'spot-records-csv'
  | 'contours-geojson'
  | 'contours-topojson'
  | 'city-aggregates-csv';

export interface ExportOption {
  readonly value: ExportFormat;
  /** The original's card title. */
  readonly label: string;
  /** The original's `.note` under it. */
  readonly desc: string;
  /** `print` goes through window.print(); `download` produces a Blob. */
  readonly kind: 'print' | 'download';
  /** Suggested filename, for the `download` kinds only. */
  readonly filename?: string;
  readonly mime?: string;
}

export const EXPORT_OPTIONS: readonly ExportOption[] = [
  { value: 'city-brief-pdf', label: 'City brief (PDF)', desc: 'One page per selected city.', kind: 'print' },
  { value: 'full-report-pdf', label: 'Full report (PDF)', desc: 'All 55 cities with national summary.', kind: 'print' },
  { value: 'spot-records-csv', label: 'Spot records (CSV)', desc: '441 rows · 30 fields.',
    kind: 'download', filename: 'suhi-spot-records.csv', mime: 'text/csv;charset=utf-8' },
  { value: 'contours-geojson', label: 'Contours (GeoJSON)', desc: 'EPSG:4326, current view.',
    kind: 'download', filename: 'suhi-contours.geojson', mime: 'application/geo+json' },
  { value: 'contours-topojson', label: 'Contours (TopoJSON)', desc: 'Compact geometry for the web.',
    kind: 'download', filename: 'suhi-contours.topojson', mime: 'application/json' },
  { value: 'city-aggregates-csv', label: 'City aggregates (CSV)', desc: '55 rows.',
    kind: 'download', filename: 'suhi-city-aggregates.csv', mime: 'text/csv;charset=utf-8' },
];

export const EXPORT_BY_VALUE = new Map(EXPORT_OPTIONS.map((o) => [o.value, o]));

/** The slice of app state an export reads. A subset of `State`, so `useAppState()[0]` passes. */
export interface ExportFilters {
  readonly contour: Contour;
  readonly cluster: string;
  readonly year: number;
  readonly city: string | null;
}

export const filtersFrom = (s: State): ExportFilters => ({
  contour: s.contour, cluster: s.cluster, year: s.year, city: s.city,
});

/* ── row filters ───────────────────────────────────────────────────────────────────────── */

/** Contour level, cluster and city scope, exactly as `statSpots` and the map apply them —
 * except that `contour: 'all'` keeps every level here, because the map draws every level when
 * it is 'all' (the levels are NESTED, so the KPI tiles narrow to L50 to avoid counting the same
 * ground three times; an export of geometry has no such double-count to avoid). */
export function filterSpotFeatures(spots: Spots, f: ExportFilters): SpotFeature[] {
  return spots.features.filter((feat) => {
    const p = feat.properties;
    return (
      (f.contour === 'all' || p.contour_level === f.contour) &&
      (f.cluster === 'all' || String(p.cluster25) === f.cluster) &&
      (!f.city || p.city === f.city)
    );
  });
}

/** Cluster and city scope. NOT contour: cities.json is an L50-only aggregation by construction
 * (see the header note in src/rail/stats.ts), so there is no per-level variant of a city row to
 * select. The chosen level still travels, as the `contour_filter` column. */
export function filterCityRows(cities: readonly City[], f: ExportFilters): City[] {
  return cities.filter(
    (c) => (f.cluster === 'all' || String(c.cluster) === f.cluster) && (!f.city || c.city === f.city),
  );
}

/* ── CSV ───────────────────────────────────────────────────────────────────────────────── */

const needsQuote = /[",\r\n]/;

/** RFC 4180 field. A comma, a quote or a newline forces quoting; internal quotes double. */
export function csvField(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header row from `columns`, then one row per record, CRLF-terminated (RFC 4180). NO BOM —
 * `buildExport` adds one for the CSV blobs; see the header note. */
export function csvText(columns: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const lines = [columns.map(csvField).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvField(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** The two derived columns every export carries, so the slider is never silently dropped. */
const YEAR_COLS = ['year', 'suhii_year'] as const;

export function spotRecordRows(spots: Spots, f: ExportFilters): { columns: string[]; rows: Record<string, unknown>[] } {
  const feats = filterSpotFeatures(spots, f);
  /* Column order is the source file's own property order, not a hand-kept list: a new attribute
   * in spots.geojson then appears in the export instead of being silently dropped. */
  const source = feats.length ? Object.keys(feats[0].properties) : [];
  return {
    columns: [...source, ...YEAR_COLS, 'contour_filter', 'cluster_filter', 'city_filter'],
    rows: feats.map((feat) => ({
      ...feat.properties,
      year: f.year,
      suhii_year: round2(spotValue(feat.properties, f.year)),
      contour_filter: f.contour,
      cluster_filter: f.cluster,
      city_filter: f.city ?? 'all',
    })),
  };
}

export function cityAggregateRows(
  cities: readonly City[],
  clusters: readonly Cluster[],
  f: ExportFilters,
): { columns: string[]; rows: Record<string, unknown>[] } {
  const rows = filterCityRows(cities, f);
  const source = rows.length ? Object.keys(rows[0]) : [];
  const typologyOf = new Map(clusters.map((k) => [k.id, k.typology]));
  return {
    /* `typology` is a JOIN, not a field of cities.json, and it is here deliberately: it is the
     * one string in the corpus carrying an EN DASH (`101–500 m`), so the encoding this module
     * promises is exercised by the real export rather than only by a unit test — and a city
     * aggregate without its typology is missing the label every other tab shows next to it. */
    columns: [...source, 'typology', ...YEAR_COLS, 'contour_filter', 'cluster_filter'],
    rows: rows.map((c) => ({
      ...c,
      typology: typologyOf.get(c.cluster) ?? '',
      year: f.year,
      // The city row's own Sen slope, the same back-cast `spotValue` applies to a spot.
      suhii_year: round2(c.suhii - ((2024 - f.year) / 10) * (c.slope || 0)),
      contour_filter: f.contour,
      cluster_filter: f.cluster,
    })),
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ── geometry ──────────────────────────────────────────────────────────────────────────── */

/** RFC 7946: GeoJSON is WGS 84 by definition and the spec REMOVED the `crs` member, so
 * "EPSG:4326" is honoured by having no crs member rather than by writing one. */
export function contourGeoJson(spots: Spots, f: ExportFilters): Spots {
  return {
    type: 'FeatureCollection',
    features: filterSpotFeatures(spots, f).map((feat) => ({
      ...feat,
      properties: { ...feat.properties, year: f.year, suhii_year: round2(spotValue(feat.properties, f.year)) },
    })),
  };
}

/** "Compact geometry for the web": shared arcs plus 1e5 quantization, which is ~1 m at this
 * latitude — finer than the contours' own source resolution and a large size win. */
export function contourTopoJson(spots: Spots, f: ExportFilters): unknown {
  return topology({ contours: contourGeoJson(spots, f) as unknown as Record<string, unknown> }, 1e5);
}

/* ── the one entry point ───────────────────────────────────────────────────────────────── */

export interface ExportData {
  readonly cities: readonly City[];
  readonly clusters: readonly Cluster[];
  readonly spots: Spots;
}

const BOM = '﻿';

/** The Blob for a `download` format, or `null` for the two `print` ones (see the header note).
 * `null` is also returned for an unknown format string, so a stale deep link cannot throw. */
export function buildExport(format: ExportFormat, data: ExportData, f: ExportFilters): Blob | null {
  const opt = EXPORT_BY_VALUE.get(format);
  if (!opt || opt.kind !== 'download') return null;
  switch (format) {
    case 'spot-records-csv': {
      const { columns, rows } = spotRecordRows(data.spots, f);
      return new Blob([BOM + csvText(columns, rows)], { type: opt.mime });
    }
    case 'city-aggregates-csv': {
      const { columns, rows } = cityAggregateRows(data.cities, data.clusters, f);
      return new Blob([BOM + csvText(columns, rows)], { type: opt.mime });
    }
    case 'contours-geojson':
      return new Blob([JSON.stringify(contourGeoJson(data.spots, f))], { type: opt.mime });
    case 'contours-topojson':
      return new Blob([JSON.stringify(contourTopoJson(data.spots, f))], { type: opt.mime });
    default:
      return null;
  }
}

/** Hands the Blob to the browser. Separated from `buildExport` so the content can be asserted
 * without a DOM download, and injected into `<Reports>` as a prop so the component suite never
 * needs `URL.createObjectURL`, which jsdom does not implement. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  /* Revoked on a macrotask rather than immediately: Safari and older Chrome abort the download
   * if the object URL dies in the same tick as the click. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
