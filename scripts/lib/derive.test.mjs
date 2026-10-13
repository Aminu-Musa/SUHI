import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { deriveCities, deriveClusters, typologyString, serialize, modal } from './derive.mjs';

const dataPath = (name) => new URL(`../../data/${name}`, import.meta.url);
const fc = JSON.parse(await readFile(dataPath('spots.geojson'), 'utf8'));

const cities = deriveCities(fc);
const clusters = deriveClusters(fc);
const city = (name) => cities.find((c) => c.city === name);

it('builds typology strings in clean UTF-8', () => {
  expect(typologyString('Grassland', 'Low (101-500m)', 'Metamorphic formation'))
    .toBe('Grassland · 101–500 m · Metamorphic');
});

it('abbreviates every elevation and geology class from the spec tables', () => {
  expect(typologyString('Built-up', 'Very Low (0-100m)', 'Sedimentary formation'))
    .toBe('Built-up · 0–100 m · Sedimentary');
  expect(typologyString('Cropland', 'Moderate (501-1000m)', 'Undifferentiated basement complex'))
    .toBe('Cropland · 501–1000 m · Basement complex');
  expect(typologyString('Shrubland', 'High (1001-1500m)', 'Sedimentary & basement formation'))
    .toBe('Shrubland · 1001–1500 m · Sedimentary & basement');
});

// The separator is U+00B7 with spaces and ranges use an en-dash U+2013. Pin the code points,
// because an ASCII '-' or '*' would read as correct in a diff but break the typology vocabulary.
it('uses U+00B7 and U+2013, never ASCII substitutes', () => {
  const s = typologyString('Grassland', 'Low (101-500m)', 'Metamorphic formation');
  expect(s).toContain('·');
  expect(s).toContain('–');
  expect(s).not.toContain('—');
  expect(s.split('·')).toHaveLength(3);
  for (const c of clusters) expect(c.typology).toBe(typologyString(c.landcover, c.elev, c.geol));
});

it('derives 55 cities and 16 occupied clusters', () => {
  expect(cities).toHaveLength(55);
  expect(clusters).toHaveLength(16);
  expect(clusters.map((c) => c.id)).toEqual([1, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 21, 23, 25]);
});

it('aggregates counts and population from L50 only', () => {
  const ibadan = city('Ibadan');
  expect(ibadan.hot).toBe(2);
  expect(ibadan.cold).toBe(2);
  expect(ibadan.pop_hot).toBe(15378);
  expect(Math.round(cities.reduce((s, c) => s + c.pop_hot, 0))).toBe(137472);
});

// L75 and L90 are nested inside L50. Summing all three counts the same ground twice and
// three times over, so an L50-only area must stay strictly below the all-levels sum.
it('does not double-count nested contours in areas', () => {
  const all = fc.features
    .filter((f) => f.properties.city === 'Ibadan' && f.properties.spot_type === 'hot')
    .reduce((s, f) => s + f.properties.area_km2, 0);
  expect(city('Ibadan').area_hot).toBe(89.45);
  expect(city('Ibadan').area_hot).toBeLessThan(all);
});

// Named for what it actually verifies. A max is immune to the nesting -- L90 is inside L75
// is inside L50, so max over L50 equals max over all levels for all 55 cities -- which means
// no test can distinguish the two scopes for this field. It pins the value, not the scope.
it('reports max_lst as the hottest reading in the city', () => {
  expect(city('Ibadan').max_lst).toBeCloseTo(43.296, 3);
  // Demonstrates why the scope is untestable here, so nobody adds a scope assertion later.
  const ibFeats = fc.features.map((f) => f.properties).filter((p) => p.city === 'Ibadan');
  const maxOf = (rows) => Math.max(...rows.map((p) => p.max_lst).filter(Number.isFinite));
  expect(maxOf(ibFeats.filter((p) => p.contour_level === 'L50'))).toBe(maxOf(ibFeats));
});

it('takes means over all contour levels', () => {
  const ibadan = city('Ibadan');
  expect(ibadan.suhii).toBe(2.34);
  expect(ibadan.mean_lst).toBe(31.24);
  expect(ibadan.slope).toBe(1.86);
  expect(ibadan.hotdays).toBe(14);
});

// DELIBERATE ARTIFACT, spec §2 -- the largest one in this file, and the reason it is kept.
// `suhii`, `slope` and `hotdays` are constant within a spot (0 of 185 spots vary across
// their levels), so averaging the rows is MULTIPLICITY-WEIGHTED: spots carry 1, 2 or 3
// levels (53/8/124), so a 3-level spot counts 3x a 1-level spot. De-duplicating to one row
// per spot would move `suhii` for 30 of 55 cities and reorder the top-10 SUHI ranking.
// Kept for fidelity to the study's published figures. Do not "fix" it -- this goes red.
it('weights suhii/slope/hotdays means by level multiplicity (deliberate: matches published figures, see spec §2)', () => {
  const p = fc.features.map((f) => f.properties);
  const spotsOf = (name) => {
    const rows = p.filter((x) => x.city === name);
    return [...new Map(rows.map((x) => [x.spot_id, x])).values()];
  };
  const r2 = (x) => Number(x.toFixed(2));
  const perSpot = (name, key) => {
    const s = spotsOf(name);
    return r2(s.reduce((a, x) => a + x[key], 0) / s.length);
  };

  // The three fields really are replicated constants, which is what makes the weighting bite.
  const bySpot = new Map();
  for (const x of p) bySpot.set(x.spot_id, [...(bySpot.get(x.spot_id) ?? []), x]);
  expect(bySpot.size).toBe(185);
  for (const rows of bySpot.values()) {
    for (const k of ['suhii', 'sen_slope_C_per_decade', 'n_modis_hot_days']) {
      expect(new Set(rows.map((x) => x[k])).size).toBe(1);
    }
  }

  // Published (weighted) values, and the de-duplicated values they would become.
  expect(city('Akure').suhii).toBe(1.6);
  expect(perSpot('Akure', 'suhii')).toBe(1.19);
  expect(city('Oshogbo').suhii).toBe(1.43);
  expect(perSpot('Oshogbo', 'suhii')).toBe(1.82);
  expect(city('Calabar').suhii).toBe(1.83);
  expect(perSpot('Calabar', 'suhii')).toBe(1.49);

  // And the ranking really does change, which is the reason this is documented not fixed.
  expect(cities.slice(0, 10).map((c) => c.city)).toEqual([
    'Ibadan', 'Ife', 'Benin City', 'Calabar', 'Uyo',
    'Ijebu-Ode', 'Ilesa', 'Ondo', 'Lagos', 'Akure',
  ]);
  const deduped = [...cities]
    .map((c) => [c.city, perSpot(c.city, 'suhii')])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);
  expect(deduped).not.toContain('Akure');
  expect(deduped).toContain('Oshogbo');
});

// `mean_lst` is NOT part of that exception: it varies per level, so averaging rows averages
// real measurements. Pinned so the two cases do not get conflated and "fixed" together.
it('averages mean_lst over genuinely varying per-level readings', () => {
  const bySpot = new Map();
  for (const x of fc.features.map((f) => f.properties)) {
    bySpot.set(x.spot_id, [...(bySpot.get(x.spot_id) ?? []), x]);
  }
  const varying = [...bySpot.values()].filter((rows) => new Set(rows.map((x) => x.mean_lst)).size > 1);
  expect(varying.length).toBe(132);
});

// DELIBERATE EXCEPTION, spec §2. `sig` and `persist` count all three contour levels while
// every other count is L50-only. This inflates both roughly 3x via the nesting and is kept
// for fidelity to the study's published figures. Do not "correct" this to L50 — see the
// comments at the call sites in derive.mjs.
it('counts sig and persist over all contour levels (deliberate: matches published figures, see spec §2)', () => {
  const ibadan = city('Ibadan');
  const l50 = (p) => p.contour_level === 'L50';
  const ibFeats = fc.features.map((f) => f.properties).filter((p) => p.city === 'Ibadan');

  expect(ibadan.persist).toBe(12);
  expect(ibFeats.filter((p) => p.persistent_dn).length).toBe(12);
  // The L50-only reading would give 4. If this assertion ever fails, the rule was changed.
  expect(ibFeats.filter((p) => l50(p) && p.persistent_dn).length).toBe(4);

  expect(city('Uyo').sig).toBe(3);
  expect(city('Umuahia').sig).toBe(4);
  for (const c of cities) {
    const feats = fc.features.map((f) => f.properties).filter((p) => p.city === c.city);
    expect(c.sig).toBe(feats.filter((p) => p.bh_significant).length);
    expect(c.persist).toBe(feats.filter((p) => p.persistent_dn).length);
  }
});

// The centroid is the mean of per-feature centroids, not a mean over a pooled vertex list:
// features have wildly unequal vertex counts, so pooling weights a 400-vertex polygon 100x
// a 4-vertex one and moves markers by up to 0.135 degrees (~15 km).
it('centroids the mean of per-feature centroids', () => {
  expect(city('Ibadan').lon).toBe(3.9882);
  expect(city('Ibadan').lat).toBe(7.3793);
  expect(city('Abeokuta').lon).toBe(3.3945);
  expect(city('Lagos').lat).toBe(6.6014);
});

// Rounding must be decimal-correct on the exact double. Katsina's L50 hot area sums to
// 49.094999999999998863, which is below 49.095, so 2 dp is 49.09 -- but scaling first
// (49.094999999999998863 * 100 === 4909.5) and then Math.round gives 49.1.
it('rounds on the exact value, not on a scaled one', () => {
  expect(city('Katsina').area_hot).toBe(49.09);
  expect(clusters.find((c) => c.id === 21).area_cold).toBe(34.6);
  // Genuine halves still round away from zero.
  expect(city('Ibadan').hotdays).toBe(14);
});

it('computes pct_hot and pct_cold against city area', () => {
  const ibadan = city('Ibadan');
  expect(ibadan.pct_hot).toBe(3);
  expect(ibadan.pct_cold).toBe(2.16);
  expect(ibadan.city_area).toBe(2983.1851);
  expect(ibadan.uc_area).toBe(588.1468);
});

// The real data contains ZERO modal ties (55 cities x 5 class fields), so nothing in the
// corpus-driven tests above -- the byte guard included -- can tell first-occurrence from
// last-occurrence, or a count-sort from a strict-greater scan. These synthetic cases are the
// only thing pinning the spec's "ties broken by first occurrence".
describe('modal tie-break', () => {
  it('has no ties in the real data, hence needs synthetic cases', () => {
    const p = fc.features.map((f) => f.properties);
    let ties = 0;
    for (const name of new Set(p.map((x) => x.city))) {
      const rows = p.filter((x) => x.city === name);
      for (const k of ['landcover_class', 'elevation_class', 'geology_class', 'climate_class', 'cluster25']) {
        const counts = new Map();
        for (const x of rows) counts.set(x[k], (counts.get(x[k]) ?? 0) + 1);
        const sorted = [...counts.values()].sort((a, b) => b - a);
        if (sorted.length > 1 && sorted[0] === sorted[1]) ties++;
      }
    }
    expect(ties).toBe(0);
  });

  it('breaks a tie by first occurrence, not last', () => {
    // 1-1 tie: 'Grassland' appears first and must win.
    expect(modal([{ k: 'Grassland' }, { k: 'Cropland' }], 'k')).toBe('Grassland');
    // Reversed input must give the reversed answer, or the tie-break is not order-sensitive.
    expect(modal([{ k: 'Cropland' }, { k: 'Grassland' }], 'k')).toBe('Cropland');
  });

  it('prefers a strict majority regardless of order', () => {
    expect(modal([{ k: 'a' }, { k: 'b' }, { k: 'b' }], 'k')).toBe('b');
    expect(modal([{ k: 'b' }, { k: 'b' }, { k: 'a' }], 'k')).toBe('b');
    // Three-way tie: first still wins.
    expect(modal([{ k: 'x' }, { k: 'y' }, { k: 'z' }], 'k')).toBe('x');
  });

  it('ignores null and undefined without letting them win', () => {
    expect(modal([{ k: null }, { k: null }, { k: 'a' }], 'k')).toBe('a');
    expect(modal([{}, {}, { k: 'a' }], 'k')).toBe('a');
    expect(modal([], 'k')).toBeNull();
  });
});

// The class fields are modal over ALL levels, not over L50. The real data cannot show the
// difference -- the two scopes agree for all 55 cities x 5 class fields -- so narrowing the
// scope to `l50` passes the whole corpus suite including the byte guard. This synthetic
// collection is built so the two scopes disagree, and pins the documented one.
it('takes dominant class fields over all levels, not just L50', () => {
  const ring = [[[0, 0], [0, 1], [1, 1], [0, 0]]];
  const row = (spotId, level, overrides) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: ring },
    properties: {
      spot_id: spotId, city: 'Scopeville', period: 'day', spot_type: 'hot',
      contour_level: level, cluster25: 1, area_km2: 1, population: 1,
      suhii: 1, mean_lst: 20, max_lst: 21, sen_slope_C_per_decade: 1,
      n_modis_hot_days: 1, bh_significant: false, persistent_dn: false,
      city_area_km2: 100, uc_area_km2: 10,
      landcover_class: 'Cropland', elevation_class: 'Low (101-500m)',
      geology_class: 'Metamorphic formation', climate_class: 'Tropical wet',
      ...overrides,
    },
  });
  // Spot A contributes one L50 row of Cropland; spot B contributes two non-L50 rows of
  // Grassland. All levels -> Grassland wins 2-1. L50 only -> Cropland wins 1-0.
  const grassland = {
    landcover_class: 'Grassland', elevation_class: 'Very Low (0-100m)',
    geology_class: 'Sedimentary formation', climate_class: 'Tropical wet and dry',
  };
  const synthetic = {
    type: 'FeatureCollection',
    features: [
      row('a_001', 'L50', {}),
      row('b_001', 'L75', grassland),
      row('b_001', 'L90', grassland),
    ],
  };

  const [scopeville] = deriveCities(synthetic);
  expect(scopeville.landcover).toBe('Grassland');
  expect(scopeville.elev).toBe('Very Low (0-100m)');
  expect(scopeville.geol).toBe('Sedimentary formation');
  expect(scopeville.climate).toBe('Tropical wet and dry');
  // An L50-scoped implementation would report Cropland here, so this assertion is the pin.
  expect(scopeville.landcover).not.toBe('Cropland');
  // And the cluster table derives its classes the same way.
  expect(deriveClusters(synthetic)[0].landcover).toBe('Grassland');
});

it('takes dominant class fields as the modal value by feature count', () => {
  const ibadan = city('Ibadan');
  expect(ibadan.landcover).toBe('Grassland');
  expect(ibadan.elev).toBe('Low (101-500m)');
  expect(ibadan.geol).toBe('Undifferentiated basement complex');
  expect(ibadan.climate).toBe('Tropical wet and dry');
  expect(ibadan.cluster).toBe(9);
});

it('orders cities by suhii descending and clusters by id', () => {
  for (let i = 1; i < cities.length; i++) {
    expect(cities[i].suhii).toBeLessThanOrEqual(cities[i - 1].suhii);
  }
  expect(cities[0].city).toBe('Ibadan');
  const ids = clusters.map((c) => c.id);
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
});

it('summarises clusters from their member cities', () => {
  const c1 = clusters.find((c) => c.id === 1);
  expect(c1.cities).toEqual(['Daura', 'Gusau']);
  expect(c1.n_cities).toBe(2);
  expect(c1.hot).toBe(2);
  expect(c1.cold).toBe(4);
  expect(c1.typology).toBe('Grassland · 101–500 m · Metamorphic');
});

// DELIBERATE EXCEPTION, the third one (spec §2). Cluster `n` counts features across all
// three contour levels, so it is a ROW count, not a spot count. Kept for fidelity to the
// published figures. Asserted against both readings so the 12 is self-explaining rather
// than a bare number a future reader would "fix" to 6.
it('counts cluster n over all contour levels, not spots (deliberate: matches published figures, see spec §2)', () => {
  const rows = fc.features.map((f) => f.properties).filter((p) => p.cluster25 === 1);
  const spots = new Set(rows.map((p) => p.spot_id));

  expect(clusters.find((c) => c.id === 1).n).toBe(12);
  expect(rows).toHaveLength(12); // all levels: what `n` reports
  expect(spots.size).toBe(6); // distinct spots: what `n` does NOT report
  expect(rows.filter((p) => p.contour_level === 'L50')).toHaveLength(6);

  // Holds for every cluster, not just cluster 1.
  for (const c of clusters) {
    expect(c.n).toBe(fc.features.filter((f) => f.properties.cluster25 === c.id).length);
  }
});

// 26 features carry a null `population` and 2 each carry null `mean_lst`/`max_lst`. All the
// null-population features are L75/L90, so the L50-only sums never see one -- but the
// all-levels means and max do, and a naive reduce would emit NaN into every downstream number.
describe('null handling', () => {
  it('has nulls in the source to handle', () => {
    const p = fc.features.map((f) => f.properties);
    expect(p.filter((x) => x.population === null)).toHaveLength(26);
    expect(p.filter((x) => x.population === null && x.contour_level === 'L50')).toHaveLength(0);
    expect(p.filter((x) => x.mean_lst === null)).toHaveLength(2);
  });

  // This asserts a property of TODAY'S OUTPUT, not a guarantee of the contract: every city
  // and cluster happens to have finite values for every field. It is not evidence that an
  // all-null group would be handled -- see the contract test below for that.
  it('produces no NaN or null for the current data', () => {
    for (const row of [...cities, ...clusters]) {
      for (const [k, v] of Object.entries(row)) {
        expect(v, `${row.city ?? row.id}.${k}`).not.toBeNull();
        if (typeof v === 'number') expect(Number.isFinite(v), `${row.city ?? row.id}.${k}`).toBe(true);
      }
    }
    expect(serialize([...cities, ...clusters])).not.toMatch(/NaN|null/);
  });

  // The documented contract: an all-null group yields null, and null survives rounding.
  // `round` must pass null through -- `Number(null.toFixed(2))` is a TypeError, so without
  // that guard every rounded call site would throw on a city whose values were all null.
  // No such city exists today, which is exactly why this needs a synthetic case.
  it('yields null for an all-null group instead of throwing', () => {
    const ring = [[[0, 0], [0, 1], [1, 1], [0, 0]]];
    const feature = (props) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: ring },
      properties: {
        spot_id: 'x_001', city: 'Nulltown', period: 'day', spot_type: 'hot',
        contour_level: 'L50', cluster25: 99, area_km2: 1, population: 1,
        suhii: null, mean_lst: null, max_lst: null, sen_slope_C_per_decade: null,
        n_modis_hot_days: null, bh_significant: false, persistent_dn: false,
        city_area_km2: 10, uc_area_km2: 5, landcover_class: 'Grassland',
        elevation_class: 'Low (101-500m)', geology_class: 'Metamorphic formation',
        climate_class: 'Tropical wet', ...props,
      },
    });
    const synthetic = { type: 'FeatureCollection', features: [feature({})] };

    const [row] = deriveCities(synthetic);
    expect(row.suhii).toBeNull();
    expect(row.mean_lst).toBeNull();
    expect(row.max_lst).toBeNull();
    expect(row.slope).toBeNull();
    expect(row.hotdays).toBeNull();
    // The finite fields still compute.
    expect(row.pop_hot).toBe(1);
    expect(row.area_hot).toBe(1);
    expect(row.pct_hot).toBe(10);
    expect(() => serialize(deriveClusters(synthetic))).not.toThrow();

    // A sum over an all-null field is 0, not null -- summing nothing is zero.
    const nullPop = { type: 'FeatureCollection', features: [feature({ population: null })] };
    expect(deriveCities(nullPop)[0].pop_hot).toBe(0);
  });

  it('keeps Bida and Port Harcourt finite despite null mean_lst', () => {
    for (const name of ['Bida', 'Port Harcourt']) {
      expect(Number.isFinite(city(name).mean_lst)).toBe(true);
      expect(Number.isFinite(city(name).max_lst)).toBe(true);
    }
  });
});

describe('serialize', () => {
  it('writes JSON.stringify(value, null, 1) plus a trailing newline', () => {
    expect(serialize({ a: 1 })).toBe('{\n "a": 1\n}\n');
  });

  it('emits no BOM and no CR', () => {
    const s = serialize(clusters);
    expect(s.charCodeAt(0)).not.toBe(0xfeff);
    expect(s).not.toMatch(/\r/);
    expect(s.endsWith('\n')).toBe(true);
  });
});

// The guard. From here on the committed JSON is derive's own output, so any change to an
// aggregation rule, a rounding decision or the serializer shows up as a red test until
// `npm run derive` is re-run and the result reviewed. It cannot reproduce the pre-derive
// files, which were minified by an unknown producer and carried no trailing newline.
it('reproduces the committed JSON byte for byte', async () => {
  expect(serialize(deriveCities(fc))).toBe(await readFile(dataPath('cities.json'), 'utf8'));
  expect(serialize(deriveClusters(fc))).toBe(await readFile(dataPath('clusters.json'), 'utf8'));
});
