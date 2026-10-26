import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { feature } from 'topojson-client';
import { describe, it, expect } from 'vitest';
import { deriveCities, deriveCitiesByPeriod, deriveClusters, typologyString, serialize, modal } from './derive.mjs';

const dataPath = (name) => new URL(`../../data/${name}`, import.meta.url);
const fc = JSON.parse(await readFile(dataPath('spots.geojson'), 'utf8'));

const cities = deriveCities(fc);
const clusters = deriveClusters(fc);
const byPeriod = deriveCitiesByPeriod(fc);
const city = (name) => cities.find((c) => c.city === name);
const period = (name, p) => byPeriod.find((r) => r.city === name && r.period === p);

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

// RULING 36 -- data/cities-by-period.json. The city table split by `period`, because
// cities.json pools the two and spec §7.5's clustered bars need them apart.
describe('cities by period', () => {
  it('emits 106 rows, not 110, because four cities have only one period in the source', () => {
    expect(byPeriod).toHaveLength(106);
    expect(period('Abonnema', 'day')).toBeDefined();
    expect(period('Abonnema', 'night')).toBeUndefined();
    for (const name of ['Ado Ekiti', 'Port Harcourt', 'Warri']) {
      expect(period(name, 'day'), `${name} has no day rows in spots.geojson`).toBeUndefined();
      expect(period(name, 'night')).toBeDefined();
    }
    // Which is the fact a consumer has to handle: 55 x 2 would be 110.
    expect(new Set(byPeriod.map((r) => r.city)).size).toBe(55);
  });

  it('orders cities exactly as cities.json does, day before night', () => {
    expect([...new Set(byPeriod.map((r) => r.city))]).toEqual(cities.map((c) => c.city));
    expect(byPeriod.slice(0, 4).map((r) => `${r.city}/${r.period}`)).toEqual([
      'Ibadan/day', 'Ibadan/night', 'Ife/day', 'Ife/night',
    ]);
  });

  it('splits the city table without changing a rule: the pooled row is still the two periods put back together', () => {
    const d = period('Ibadan', 'day');
    const n = period('Ibadan', 'night');
    const pooled = city('Ibadan');
    // L50-only counts, areas and populations partition cleanly across the two periods.
    expect(d.hot + n.hot).toBe(pooled.hot);
    expect(d.cold + n.cold).toBe(pooled.cold);
    expect(d.pop_hot + n.pop_hot).toBe(pooled.pop_hot);
    expect(Number((d.area_hot + n.area_hot).toFixed(2))).toBe(pooled.area_hot);
    // And it holds for every city that has both periods.
    for (const c of cities) {
      const rows = byPeriod.filter((r) => r.city === c.city);
      expect(rows.reduce((s, r) => s + r.hot, 0), `${c.city}.hot`).toBe(c.hot);
      expect(rows.reduce((s, r) => s + r.cold, 0), `${c.city}.cold`).toBe(c.cold);
    }
  });

  it('splits suhii/slope/hotdays into the two figures the pooled mean was hiding', () => {
    expect(period('Ibadan', 'day').suhii).toBe(3.43);
    expect(period('Ibadan', 'night').suhii).toBe(1.26);
    expect(period('Ibadan', 'day').slope).toBe(2.86);
    expect(period('Ibadan', 'night').hotdays).toBe(14);
    // The pooled figure sits BETWEEN the two, which is the whole reason the split exists:
    // 2.34 tells you nothing about a 3.43 day against a 1.26 night.
    expect(city('Ibadan').suhii).toBeGreaterThan(period('Ibadan', 'night').suhii);
    expect(city('Ibadan').suhii).toBeLessThan(period('Ibadan', 'day').suhii);
  });

  // NAMED FOR WHAT IT ACTUALLY VERIFIES, the way the city table's `max_lst` test is. The code
  // takes these three means over ALL levels, and that is deliberate (it is the city table's own
  // rule, spec §2) -- but NO test can distinguish the two scopes here, because `suhii`, `slope`
  // and `hotdays` turn out to be constant across every row of a city+period: they are
  // city-period attributes, not per-spot measurements. So the multiplicity weighting that moves
  // 30 of 55 cities in the POOLED table is provably a no-op in this one, and narrowing the
  // scope to L50 would leave all 106 rows' suhii, slope and hotdays byte-identical. The thing
  // that does move is `mean_lst`, pinned in the next test. This exists so nobody adds a
  // "weighted, not per-spot" assertion here believing it holds anything down.
  it('cannot distinguish the mean scope for suhii/slope/hotdays, because all three are constant within a city+period', () => {
    const p = fc.features.map((f) => f.properties);
    for (const k of ['suhii', 'sen_slope_C_per_decade', 'n_modis_hot_days']) {
      for (const r of byPeriod) {
        const rows = p.filter((x) => x.city === r.city && x.period === r.period);
        expect(new Set(rows.map((x) => x[k])).size, `${r.city}/${r.period}.${k}`).toBe(1);
      }
    }
    // Level multiplicity really does vary inside 42 of the 106 groups, so the weighting is live
    // machinery with nothing to weight -- not an accident of uniform groups.
    let unequal = 0;
    for (const r of byPeriod) {
      const counts = new Map();
      for (const x of p.filter((y) => y.city === r.city && y.period === r.period)) {
        counts.set(x.spot_id, (counts.get(x.spot_id) ?? 0) + 1);
      }
      if (new Set(counts.values()).size > 1) unequal++;
    }
    expect(unequal).toBe(42);
  });

  // `mean_lst` IS scope-sensitive, because it varies per level, so this is the assertion that
  // actually holds the all-levels rule down: narrowing to L50 moves 96 of the 106 rows.
  it('takes mean_lst over all contour levels, which moves 96 of the 106 rows', () => {
    const p = fc.features.map((f) => f.properties);
    const avg = (rows) => {
      const vs = rows.map((x) => x.mean_lst).filter((v) => typeof v === 'number' && Number.isFinite(v));
      return vs.length ? Number((vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2)) : null;
    };
    let moved = 0;
    for (const r of byPeriod) {
      const rows = p.filter((x) => x.city === r.city && x.period === r.period);
      expect(avg(rows), `${r.city}/${r.period}`).toBe(r.mean_lst);
      if (avg(rows.filter((x) => x.contour_level === 'L50')) !== r.mean_lst) moved++;
    }
    expect(moved).toBe(96);
    expect(period('Aba', 'day').mean_lst).toBe(37.13);
  });

  it('divides both periods by the same city area, so the two shares are shares of one city', () => {
    const d = period('Ibadan', 'day');
    const n = period('Ibadan', 'night');
    expect(d.pct_hot).toBe(0.97);
    expect(n.pct_hot).toBe(2.03);
    const area = city('Ibadan').city_area;
    expect(Number(((d.area_hot / area) * 100).toFixed(2))).toBe(d.pct_hot);
    expect(Number(((n.area_hot / area) * 100).toFixed(2))).toBe(n.pct_hot);
  });

  // The split SURFACES a null the pooled table hid, which is the case Compare has to draw
  // around. Bida's only night feature carries a null mean_lst and max_lst, so the night
  // figures are null while cities.json reports finite ones (its day rows are finite).
  it('reports null where a period has no reading, even though the pooled row is finite', () => {
    const n = period('Bida', 'night');
    expect(n.mean_lst).toBeNull();
    expect(n.max_lst).toBeNull();
    expect(Number.isFinite(city('Bida').mean_lst)).toBe(true);
    // It is the only null in the file; everything else is finite.
    const nulls = byPeriod.filter((r) => Object.values(r).some((v) => v === null));
    expect(nulls.map((r) => `${r.city}/${r.period}`)).toEqual(['Bida/night']);
  });

  it('reproduces the committed JSON byte for byte', async () => {
    expect(serialize(deriveCitiesByPeriod(fc))).toBe(await readFile(dataPath('cities-by-period.json'), 'utf8'));
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

describe('data/spots.topo.json', () => {
  const readTopo = async () => JSON.parse(await readFile(dataPath('spots.topo.json'), 'utf8'));

  it('round-trips every feature through TopoJSON', async () => {
    const topo = await readTopo();
    const back = feature(topo, topo.objects.spots);
    expect(back.features).toHaveLength(441);
    const ids = new Set(back.features.map((f) => f.properties.spot_id));
    for (const f of fc.features) expect(ids.has(f.properties.spot_id)).toBe(true);
  });

  // The brief asked for <400 KB on disk. That is unreachable without degrading contours:
  // 343 KB of the file is the 441 x 30 repeated attribute keys and values, which TopoJSON
  // cannot columnarise, leaving ~57 KB for 36,000 vertices. Every static host gzips JSON,
  // and gzip collapses the repeated keys ~7x, so the wire size is the honest measure.
  it('keeps the gzipped payload under 400 KB because every visitor downloads it before seeing a polygon', async () => {
    const gz = gzipSync(await readFile(dataPath('spots.topo.json'))).length;
    expect(gz).toBeLessThan(400 * 1024);
  });

  it('caps the raw file at 600 KB so a looser tolerance cannot creep in unnoticed', async () => {
    expect((await stat(dataPath('spots.topo.json'))).size).toBeLessThan(600 * 1024);
  });

  it('moves no vertex more than 12 m, under one pixel at zoom 13, so contours stay pixel-identical and simplification stays off (even 1e-10 moves a spike 267 m)', async () => {
    const topo = await readTopo();
    const back = feature(topo, topo.objects.spots);
    const M = 111320; // metres per degree of latitude
    const segDist = (p, a, b) => {
      const kx = Math.cos((p[1] * Math.PI) / 180) * M;
      const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * M;
      const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * M;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      return Math.hypot(ax + t * dx, ay + t * dy);
    };
    const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
    let worst = 0;
    // spot_id is NOT unique (185 distinct across 441 features), so pair by index; order is preserved.
    for (const [i, f] of fc.features.entries()) {
      const rings = polys(back.features[i].geometry).flat();
      for (const ring of polys(f.geometry).flat()) {
        for (const pt of ring) {
          let best = Infinity;
          for (const r of rings) for (let i = 1; i < r.length; i++) best = Math.min(best, segDist(pt, r[i - 1], r[i]));
          worst = Math.max(worst, best);
        }
      }
    }
    expect(worst).toBeLessThan(12);
  });

  it('retains at least 30 attributes per feature (31 exist)', async () => {
    const topo = await readTopo();
    const back = feature(topo, topo.objects.spots);
    for (const f of back.features) expect(Object.keys(f.properties).length).toBeGreaterThanOrEqual(30);
    expect(Object.keys(back.features[0].properties)).toEqual(Object.keys(fc.features[0].properties));
  });
});
