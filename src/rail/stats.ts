/* The aggregation behind the KPI tiles and the confidence bars.
 *
 * Transcribed from the prototype: `fmt` (line 572), `statSpots` (687-702), `spotValue` (704)
 * and the arithmetic at the top of `renderKPIs` (1028-1041). Pure functions, kept out of the
 * components so the zero-spot case can be asserted on numbers as well as on rendered text.
 *
 * TWO THINGS THAT LOOK WRONG AND ARE NOT:
 *
 * 1. `statSpots` keeps L50 ONLY, while the map draws every level when state.contour is 'all'.
 *    The levels are NESTED (L50 outer, L90 the dense core), so summing all three counts the
 *    same ground two and three times over. The original says so in a comment above the
 *    function and the rail's own contour note says so on screen. It also means the KPI tiles
 *    DO NOT respond to the contour segment at all - only to city and cluster.
 * 2. `statSpots` ignores `state.contour` for the same reason, and `spotValue` back-casts
 *    with the Sen slope from 2024 even when the year slider is at 2015, so the KPI figures do
 *    move with the year.
 */

import { mean, sum, format } from 'd3';
import type { City, SpotFeature, SpotProperties, Spots } from '../app/data';
import type { State } from '../app/state';

/** Prototype line 572. `null` AND `undefined` both reach the em dash, which is the only thing
 * standing between an empty filter and `d3.mean([]) -> undefined -> "NaN"` on screen. */
export const fmt = (n: number | null | undefined, d = 0): string =>
  n == null ? '—' : format(',.' + d + 'f')(n);

/** Prototype line 704. The year slider back-casts from 2024 using each spot's Sen slope. */
export const spotValue = (p: SpotProperties, year: number): number =>
  (p.suhii || 0) - ((2024 - year) / 10) * (p.sen_slope_C_per_decade || 0);

/** Prototype lines 689-702. L50 only - see the header note. */
export function statSpots(spots: Spots, state: State, period: 'day' | 'night'): SpotFeature[] {
  return spots.features.filter((f) => {
    const p = f.properties;
    return (
      p.contour_level === 'L50' &&
      p.period === period &&
      (state.cluster === 'all' || String(p.cluster25) === state.cluster) &&
      (!state.city || p.city === state.city)
    );
  });
}

export interface KpiStats {
  /** Day spots then night spots, in that order - the original's `[...day, ...night]`. */
  feats: SpotFeature[];
  hot: SpotFeature[];
  cold: SpotFeature[];
  /** Summed population inside hot / cold spots. */
  pop: number;
  popC: number;
  /** Summed spot area, km². */
  ah: number;
  ac: number;
  /** Denominator: the scoped city's area, or every city's area summed. */
  cityArea: number;
  pctHot: number;
  pctCold: number;
  clusters: number;
  /** `undefined` when no hot spot is selected: d3.mean of an empty array. */
  meanS: number | undefined;
}

/** Prototype lines 1029-1037. */
export function kpiStats(spots: Spots, cities: City[], state: State): KpiStats {
  const feats = [...statSpots(spots, state, 'day'), ...statSpots(spots, state, 'night')];
  const hot = feats.filter((f) => f.properties.spot_type === 'hot');
  const cold = feats.filter((f) => f.properties.spot_type === 'cold');
  const pop = sum(hot, (f) => f.properties.population || 0);
  const popC = sum(cold, (f) => f.properties.population || 0);
  const ah = sum(hot, (f) => f.properties.area_km2 || 0);
  const ac = sum(cold, (f) => f.properties.area_km2 || 0);
  const scope = state.city ? cities.find((c) => c.city === state.city) : null;
  const cityArea = scope ? scope.city_area : sum(cities, (c) => c.city_area);
  return {
    feats,
    hot,
    cold,
    pop,
    popC,
    ah,
    ac,
    cityArea,
    pctHot: (ah / cityArea) * 100,
    pctCold: (ac / cityArea) * 100,
    clusters: new Set(feats.map((f) => f.properties.cluster25)).size,
    meanS: mean(hot, (f) => spotValue(f.properties, state.year)),
  };
}

/** Prototype lines 1062-1063. The four Mann-Kendall p-value bins and their bar fills.
 * These are FILLS, so they keep the plain ramp tokens; only ramp-coloured TEXT moves to -ink. */
export const CONF_BINS: readonly { readonly label: string; readonly token: string; readonly test: (f: SpotFeature) => boolean }[] = [
  { label: 'p < 0.01', token: '--hot-5', test: (f) => f.properties.mk_p_value < 0.01 },
  { label: '0.01–0.05', token: '--hot-3', test: (f) => f.properties.mk_p_value >= 0.01 && f.properties.mk_p_value < 0.05 },
  { label: '0.05–0.10', token: '--hot-1', test: (f) => f.properties.mk_p_value >= 0.05 && f.properties.mk_p_value < 0.1 },
  { label: '≥ 0.10', token: '--color-neutral-500', test: (f) => f.properties.mk_p_value >= 0.1 },
];

export interface ConfBin {
  label: string;
  token: string;
  n: number;
  /** Already a percentage string-ready number. `max` falls back to 1 (prototype line 1064), so
   * an all-empty set gives 0% rather than 0/0 = NaN. */
  pct: number;
}

/** Prototype lines 1062-1068. */
export function confBins(feats: SpotFeature[]): { bins: ConfBin[]; significant: number; total: number } {
  const counts = CONF_BINS.map((b) => feats.filter(b.test).length);
  const max = Math.max(...counts, 0) || 1;
  return {
    bins: CONF_BINS.map((b, i) => ({ label: b.label, token: b.token, n: counts[i], pct: (counts[i] / max) * 100 })),
    significant: feats.filter((f) => f.properties.bh_significant).length,
    total: feats.length,
  };
}
