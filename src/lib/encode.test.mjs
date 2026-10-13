import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildReferenceMeans, encodeValue, ENCODE_DOMAIN, ENCODE_FIELD } from './encode.mjs';

const fc = JSON.parse(readFileSync(new URL('../../data/spots.geojson', import.meta.url), 'utf8'));

describe('encodeValue', () => {
  it('computes lst_rel against the city/period L50 mean', () => {
    const refs = buildReferenceMeans(fc.features);
    const p = fc.features.find(f => f.properties.spot_id === 'aba_dc_T2_001').properties;
    expect(encodeValue(p, refs)).toBeCloseTo(p.mean_lst - refs.get('Aba|day'), 6);
  });

  it('agrees in sign with spot_type for at least 85% of spots', () => {
    const refs = buildReferenceMeans(fc.features);
    const scored = fc.features.map(f => [f.properties, encodeValue(f.properties, refs)])
      .filter(([, v]) => v !== null);
    const ok = scored.filter(([p, v]) =>
      (p.spot_type === 'hot' && v > 0) || (p.spot_type === 'cold' && v < 0)).length;
    expect(ok / scored.length).toBeGreaterThan(0.85);   // measured: 86.3%
  });

  // Review Focus 1 — the two null mean_lst spots
  it('returns null for a spot with no mean_lst, and never NaN', () => {
    const refs = buildReferenceMeans(fc.features);
    expect(encodeValue({ city: 'Aba', period: 'day', mean_lst: null }, refs)).toBeNull();
    for (const f of fc.features) expect(encodeValue(f.properties, refs)).not.toBeNaN();
  });

  // Review Focus 2 — a city/period with no L50 reference
  it('returns null when the city/period has no reference mean', () => {
    const refs = buildReferenceMeans(fc.features);
    expect(encodeValue({ city: 'Nowhere', period: 'night', mean_lst: 30 }, refs)).toBeNull();
  });
});

describe('buildReferenceMeans', () => {
  it('excludes null mean_lst from the reference mean', () => {
    const refs = buildReferenceMeans([
      { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: 30 } },
      { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: null } },
    ]);
    expect(refs.get('X|day')).toBe(30);
  });

  it('references only L50 spots, and keeps day and night separate', () => {
    const refs = buildReferenceMeans([
      { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: 30 } },
      { properties: { city: 'X', period: 'day', contour_level: 'L90', mean_lst: 40 } },
      { properties: { city: 'X', period: 'night', contour_level: 'L50', mean_lst: 20 } },
    ]);
    expect(refs.get('X|day')).toBe(30);
    expect(refs.get('X|night')).toBe(20);
  });
});

describe('encoding contract', () => {
  // lst_rel is an INTERIM PROXY. Naming it gi_z would claim a statistic we do not have.
  it('is named lst_rel, not gi_z, because it is a proxy and not the Gi* statistic', () => {
    expect(ENCODE_FIELD).toBe('lst_rel');
    expect(ENCODE_FIELD).not.toMatch(/gi/i);
  });

  it('keeps a symmetric diverging domain so the ramp midpoint stays neutral', () => {
    expect(ENCODE_DOMAIN).toEqual([-4.5, 4.5]);
  });
});
