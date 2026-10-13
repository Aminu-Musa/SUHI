/**
 * Aggregation of `data/spots.geojson` into the city and cluster tables the dashboard reads.
 *
 * THE RULE THAT MATTERS: the three contour levels nest. L90 (dense core) sits inside L75,
 * which sits inside L50. So every count, area and population aggregates `contour_level`
 * === 'L50' ONLY -- summing all three counts the same ground two and three times over.
 *
 * Means and `max_lst` are taken over all levels, but the reason differs per field, and the
 * distinction matters:
 *   - `mean_lst` genuinely varies per level (132 of 185 spots differ across their levels),
 *     so averaging the rows is averaging real measurements.
 *   - `suhii`, `slope` and `hotdays` are CONSTANT within a spot -- 0 of 185 spots vary. The
 *     rows are replicated, not measured, so averaging them is multiplicity-weighted rather
 *     than a mean over spots. See the call site; this is a deliberate exception.
 *   - `max_lst` is a max, so nesting cannot affect it: a max over L50 equals a max over all
 *     levels for all 55 cities.
 *
 * There are THREE deliberate exceptions to the L50-only rule, each flagged at its call site
 * and pinned by a named test: `sig`, `persist`, and cluster `n`. The `suhii`/`slope`/
 * `hotdays` means are a fourth deliberate artifact of the same nesting. All four reproduce
 * the study's published figures and must not be "corrected" without an explicit decision.
 *
 * Spec: §2, §9.2.
 */

/** `elevation_class` -> typology abbreviation. Ranges use an en-dash (U+2013). */
const ELEVATION_ABBR = {
  'Very Low (0-100m)': '0–100 m',
  'Low (101-500m)': '101–500 m',
  'Moderate (501-1000m)': '501–1000 m',
  'High (1001-1500m)': '1001–1500 m',
};

/** `geology_class` -> typology abbreviation. */
const GEOLOGY_ABBR = {
  'Metamorphic formation': 'Metamorphic',
  'Sedimentary formation': 'Sedimentary',
  'Sedimentary & basement formation': 'Sedimentary & basement',
  'Undifferentiated basement complex': 'Basement complex',
};

/** Separator between typology parts: U+00B7 MIDDLE DOT, spaced. */
const SEP = ' · ';

/**
 * Build a cluster typology label from the clean UTF-8 source class fields.
 *
 * Always construct the string from the source vocabularies rather than transforming an
 * existing label: the source fields in `spots.geojson` are clean UTF-8, so building fresh
 * and writing UTF-8 cannot introduce an encoding fault. There is no repair step because
 * there is nothing to repair.
 */
export function typologyString(landcover, elevationClass, geologyClass) {
  const elev = ELEVATION_ABBR[elevationClass] ?? elevationClass;
  const geol = GEOLOGY_ABBR[geologyClass] ?? geologyClass;
  return `${landcover}${SEP}${elev}${SEP}${geol}`;
}

/**
 * Round to `digits` decimals on the exact double value.
 *
 * Deliberately NOT `Math.round(x * 10 ** digits) / 10 ** digits`: the scaling step
 * introduces its own error. Katsina's L50 hot area sums to 49.094999999999998863, which is
 * below 49.095 and so rounds to 49.09 -- but `49.094999999999998863 * 100` evaluates to
 * exactly 4909.5, and Math.round would hand back 49.1. `toFixed` rounds the real value.
 *
 * Passes `null` through untouched, so an all-null group stays null instead of throwing.
 * Without that, `mean`'s null result would hit `null.toFixed(...)` and raise a TypeError at
 * every rounded call site. No group is all-null in the current data, so this never fires
 * today -- it is here to make `mean`'s documented contract actually true.
 */
const round = (x, digits) => (x === null ? null : Number(x.toFixed(digits)));

/** Finite numbers only -- the source carries nulls, and one null would poison a reduce. */
const numbers = (rows, key) =>
  rows.map((r) => r[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));

const sum = (rows, key) => numbers(rows, key).reduce((s, v) => s + v, 0);

/**
 * Mean over the non-null values, or null for an all-null group. Never NaN.
 *
 * `round` passes null through, so a null result survives to the output as null rather than
 * throwing. No group is all-null in the current data; 2 spots have a null `mean_lst`, and
 * their cities have other finite rows.
 */
const mean = (rows, key) => {
  const vs = numbers(rows, key);
  return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
};

/** Max over the non-null values, or null for an all-null group. */
const max = (rows, key) => {
  const vs = numbers(rows, key);
  return vs.length ? Math.max(...vs) : null;
};

/**
 * Modal value by feature count; ties broken by FIRST occurrence (spec §2).
 *
 * The strict `n > bestCount` is what implements the tie-break: `>=` would silently flip this
 * to last-occurrence. Insertion order of the Map is first-appearance order, so the first
 * value to reach the winning count keeps it. There are zero ties in the real data (checked:
 * 55 cities x 5 class fields), so only the synthetic test in derive.test.mjs pins this.
 *
 * Exported solely so that test can reach it.
 */
export const modal = (rows, key) => {
  const counts = new Map();
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
};

/** Group rows into a Map keyed by `rows[i][key]`, preserving first-appearance order. */
const groupBy = (rows, key) => {
  const out = new Map();
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return out;
};

/** Every position in a Polygon or MultiPolygon, at any nesting depth. */
const positions = (geometry) => {
  const out = [];
  const walk = (node) => {
    if (typeof node[0] === 'number') out.push(node);
    else for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
  return out;
};

/**
 * Centroid of a city: the unweighted mean of its features' centroids, where each feature's
 * centroid is the unweighted mean of its own positions. All contour levels participate.
 *
 * NOT the mean of one pooled list of every position: features have wildly unequal vertex
 * counts, so pooling weights a 400-vertex polygon 100x a 4-vertex one and shifts markers by
 * up to 0.135 degrees (~15 km), enough to land a city in the wrong state.
 */
const centroid = (features) => {
  const centroids = features.map((f) => {
    const ps = positions(f.geometry);
    return [
      ps.reduce((s, p) => s + p[0], 0) / ps.length,
      ps.reduce((s, p) => s + p[1], 0) / ps.length,
    ];
  });
  return [
    centroids.reduce((s, c) => s + c[0], 0) / centroids.length,
    centroids.reduce((s, c) => s + c[1], 0) / centroids.length,
  ];
};

const isL50 = (p) => p.contour_level === 'L50';

/** Aggregate the feature collection into one row per city, ordered by `suhii` descending. */
export function deriveCities(fc) {
  const rows = [];

  for (const [city, features] of groupBy(fc.features, (f) => f.properties.city)) {
    const all = features.map((f) => f.properties);
    const l50 = all.filter(isL50);
    const hot = l50.filter((p) => p.spot_type === 'hot');
    const cold = l50.filter((p) => p.spot_type === 'cold');

    const areaHot = sum(hot, 'area_km2');
    const areaCold = sum(cold, 'area_km2');
    const cityArea = all[0].city_area_km2;
    const [lon, lat] = centroid(features);

    rows.push({
      city,
      lon: round(lon, 4),
      lat: round(lat, 4),
      // L50 only: L75 and L90 are nested inside L50.
      hot: hot.length,
      cold: cold.length,
      area_hot: round(areaHot, 2),
      area_cold: round(areaCold, 2),
      pop_hot: round(sum(hot, 'population'), 0),
      pop_cold: round(sum(cold, 'population'), 0),
      // DELIBERATE, and the largest nesting artifact in this file. `suhii`, `slope` and
      // `hotdays` are CONSTANT within a spot -- 0 of 185 spots vary across their levels --
      // so these rows are replicated, not measured. Averaging them is therefore
      // MULTIPLICITY-WEIGHTED, not a mean over spots: spots carry 1, 2 or 3 levels
      // (53/8/124 of them), so a 3-level spot counts 3x a 1-level spot.
      //
      // The effect is not cosmetic. De-duplicating to one row per spot would change the
      // displayed `suhii` for 30 of 55 cities (Akure 1.60 -> 1.19, Oshogbo 1.43 -> 1.82,
      // Calabar 1.83 -> 1.49) and, because the table sorts by `suhii`, would change both
      // the membership and the order of the top-10 SUHI ranking: Calabar #4 -> #10, Akure
      // drops out, Oshogbo enters.
      //
      // Kept as-is for fidelity to the study's published figures, consistent with the
      // author's decision on the identical question for `sig`/`persist` (spec §2). Do NOT
      // de-duplicate by `spot_id` without an explicit decision; a pinning test in
      // derive.test.mjs will go red if you do.
      //
      // `mean_lst` and `max_lst` are interleaved below only because the key order of the
      // published JSON is fixed; they are NOT part of this exception. `mean_lst` genuinely
      // varies per level (132 of 185 spots), and a max is immune to the nesting.
      suhii: round(mean(all, 'suhii'), 2),
      mean_lst: round(mean(all, 'mean_lst'), 2),
      max_lst: max(all, 'max_lst'),
      slope: round(mean(all, 'sen_slope_C_per_decade'), 2),
      hotdays: round(mean(all, 'n_modis_hot_days'), 0),
      city_area: cityArea,
      uc_area: all[0].uc_area_km2,

      // DELIBERATE EXCEPTION to the L50-only rule (spec §2). `sig` and `persist` count ALL
      // THREE contour levels ON PURPOSE. Because the levels nest and these flags are
      // constant across a spot's three levels, both figures are inflated roughly 3x -- e.g.
      // Ibadan's persist of 12 is 4 spots x 3 levels, not 12 events. That is the study
      // author's explicit decision, kept so the dashboard keeps matching the published
      // figures. Do NOT "correct" this to `l50`: it would silently change `persist` for 30
      // cities and `sig` for 8. A pinning test in derive.test.mjs will go red if you do.
      sig: all.filter((p) => p.bh_significant).length,
      persist: all.filter((p) => p.persistent_dn).length,

      pct_hot: round((areaHot / cityArea) * 100, 2),
      pct_cold: round((areaCold / cityArea) * 100, 2),
      landcover: modal(all, 'landcover_class'),
      elev: modal(all, 'elevation_class'),
      geol: modal(all, 'geology_class'),
      climate: modal(all, 'climate_class'),
      cluster: modal(all, 'cluster25'),
    });
  }

  // Stable sort, so ties keep their first-appearance order from the source.
  rows.sort((a, b) => b.suhii - a.suhii);
  return rows;
}

/** Aggregate the feature collection into one row per occupied cluster, ordered by id. */
export function deriveClusters(fc) {
  const rows = [];

  for (const [id, all] of groupBy(fc.features.map((f) => f.properties), 'cluster25')) {
    const l50 = all.filter(isL50);
    const hot = l50.filter((p) => p.spot_type === 'hot');
    const cold = l50.filter((p) => p.spot_type === 'cold');
    const cities = [...new Set(all.map((p) => p.city))].sort();

    const landcover = modal(all, 'landcover_class');
    const elev = modal(all, 'elevation_class');
    const geol = modal(all, 'geology_class');

    rows.push({
      id,
      // DELIBERATE EXCEPTION, the third one (spec §2). `n` counts features across ALL THREE
      // contour levels, so it is a row count, not a spot count -- cluster 1's n is 12, not
      // the 6 spots it actually contains. Same nesting inflation as `sig`/`persist`, kept
      // for fidelity to the published figures. Do NOT change this to `l50.length` or to a
      // distinct `spot_id` count; a pinning test in derive.test.mjs will go red.
      n: all.length,
      // L50 only: L75 and L90 are nested inside L50.
      hot: hot.length,
      cold: cold.length,
      cities,
      n_cities: cities.length,
      landcover,
      elev,
      geol,
      climate: modal(all, 'climate_class'),
      typology: typologyString(landcover, elev, geol),
      suhii: round(mean(all, 'suhii'), 2),
      slope: round(mean(all, 'sen_slope_C_per_decade'), 2),
      pop_hot: round(sum(hot, 'population'), 0),
      pop_cold: round(sum(cold, 'population'), 0),
      area_hot: round(sum(hot, 'area_km2'), 1),
      area_cold: round(sum(cold, 'area_km2'), 1),
    });
  }

  rows.sort((a, b) => a.id - b.id);
  return rows;
}

/**
 * The single writer. Both the CLI and the byte-for-byte test go through this, so they
 * cannot disagree about formatting.
 */
export function serialize(value) {
  return `${JSON.stringify(value, null, 1)}\n`;
}
