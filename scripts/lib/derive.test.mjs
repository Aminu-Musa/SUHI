import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { deriveCities, deriveClusters, typologyString, serialize } from './derive.mjs';

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

it('takes max_lst over all contour levels', () => {
  expect(city('Ibadan').max_lst).toBeCloseTo(43.296, 3);
});

it('takes means over all contour levels', () => {
  const ibadan = city('Ibadan');
  expect(ibadan.suhii).toBe(2.34);
  expect(ibadan.mean_lst).toBe(31.24);
  expect(ibadan.slope).toBe(1.86);
  expect(ibadan.hotdays).toBe(14);
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
  expect(c1.n).toBe(12);
  expect(c1.hot).toBe(2);
  expect(c1.cold).toBe(4);
  expect(c1.typology).toBe('Grassland · 101–500 m · Metamorphic');
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

  it('never produces NaN or null in the output', () => {
    for (const row of [...cities, ...clusters]) {
      for (const [k, v] of Object.entries(row)) {
        expect(v, `${row.city ?? row.id}.${k}`).not.toBeNull();
        if (typeof v === 'number') expect(Number.isFinite(v), `${row.city ?? row.id}.${k}`).toBe(true);
      }
    }
    expect(serialize([...cities, ...clusters])).not.toMatch(/NaN|null/);
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
