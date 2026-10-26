/* The three data files, typed, and the hook that loads them.
 *
 * The original fetched them inside a Promise.all at boot (prototype lines 592-596):
 *
 *   d3.json('../data/cities.json'), d3.json('../data/clusters.json'), d3.json('../data/spots.geojson')
 *
 * Those paths are RELATIVE TO THE PAGE, and they are kept that way rather than turned into
 * build-time imports, for two reasons. spots.geojson is 931 KB: inlining it would put a
 * megabyte of polygons into the main JS bundle, which is a real regression in a deliverable
 * whose own prototype streams it as data. And the fidelity guard serves both pages from the
 * repository root (tests/fidelity/server.mjs), where `../data/...` resolves to /data/... from
 * /project/nigeria-suhi-dashboard.html AND from /dist/index.html - so the rebuilt page reads
 * exactly the bytes the original does, over the same URL, with no copy to keep in step.
 *
 * `document.baseURI` is the resolution base, not `import.meta.url`: the bundled module lives in
 * /dist/assets/, so resolving against the module would ask for /dist/data/.
 *
 * Shapes are transcribed from the files, not designed. `population` is a fractional count
 * (WorldPop raster sums), `cluster25` is a NUMBER in the geojson while `state.cluster` and
 * clusters.json `id` are strings - the original bridges that with String(p.cluster25) at every
 * comparison (prototype lines 683, 700) and so do we. Do not "fix" either side.
 */

import { useEffect, useState } from 'react';

export interface City {
  city: string;
  lon: number;
  lat: number;
  hot: number;
  cold: number;
  area_hot: number;
  area_cold: number;
  pop_hot: number;
  pop_cold: number;
  suhii: number;
  mean_lst: number;
  max_lst: number;
  slope: number;
  hotdays: number;
  city_area: number;
  uc_area: number;
  sig: number;
  persist: number;
  pct_hot: number;
  pct_cold: number;
  landcover: string;
  elev: string;
  geol: string;
  climate: string;
  cluster: number;
}

/* RULING 36 - one row per city PER PERIOD, from data/cities-by-period.json.
 *
 * `City` above pools day and night in all 25 of its fields, so nothing in it can answer the
 * question spec §7.5's clustered bars ask. This is the same aggregation under the same rules,
 * narrowed to one period: see the long note on `deriveCitiesByPeriod` in scripts/lib/derive.mjs,
 * which is the SINGLE OWNER of these figures. Do not re-aggregate spots.geojson in a component.
 *
 * `mean_lst` and `max_lst` are `number | null` and the others are not, because the split
 * SURFACES a null the pooled table hid: Bida's only night feature carries no LST reading, so
 * Bida/night is null where cities.json is finite. 106 rows, not 110 - four cities have only one
 * period in the source - so a lookup can legitimately miss. */
export interface CityPeriod {
  city: string;
  period: 'day' | 'night';
  hot: number;
  cold: number;
  area_hot: number;
  area_cold: number;
  pop_hot: number;
  pop_cold: number;
  suhii: number;
  mean_lst: number | null;
  max_lst: number | null;
  slope: number;
  hotdays: number;
  pct_hot: number;
  pct_cold: number;
}

export interface Cluster {
  id: number;
  n: number;
  hot: number;
  cold: number;
  /** An ARRAY of city names in clusters.json, not a joined string - `renderClusterCard` calls
   * `k.cities.join(', ')` on it (prototype line 816). Typed `string` here until Task 5 needed
   * that call. */
  cities: string[];
  n_cities: number;
  landcover: string;
  elev: string;
  geol: string;
  climate: string;
  typology: string;
  suhii: number;
  slope: number;
  pop_hot: number;
  pop_cold: number;
  area_hot: number;
  area_cold: number;
}

export interface SpotProperties {
  spot_id: string;
  city: string;
  period: 'day' | 'night';
  spot_type: 'hot' | 'cold';
  cluster25: number;
  contour_level: 'L50' | 'L75' | 'L90';
  area_km2: number;
  population: number;
  suhii: number;
  mean_lst: number;
  max_lst: number;
  sen_slope_C_per_decade: number;
  mk_p_value: number;
  bh_significant: boolean;
  n_modis_hot_days: number;
  city_area_km2: number;
  [extra: string]: unknown;
}

export interface SpotFeature {
  type: 'Feature';
  properties: SpotProperties;
  geometry: { type: string; coordinates: unknown };
}

export interface Spots {
  type: 'FeatureCollection';
  features: SpotFeature[];
}

export interface SuhiData {
  cities: City[];
  clusters: Cluster[];
  spots: Spots;
  /** Ruling 36, Task 8. Only Compare reads it; it is 15 KB, so it joins the boot Promise.all
   * rather than being fetched on a tab switch - the original fetched everything up front and
   * rendered every panel at boot (prototype line 1175), and a tab that loads is a different
   * page from the one the fidelity guard measures. */
  citiesByPeriod: CityPeriod[];
}

/** The prototype's own three URLs, resolved against the page exactly as it resolved them, plus
 * ruling 36's fourth - which the prototype has no counterpart for, because the chart that needs
 * it is spec §7.5's one change to Compare. */
export const DATA_URLS = [
  '../data/cities.json',
  '../data/clusters.json',
  '../data/spots.geojson',
  '../data/cities-by-period.json',
] as const;

export async function loadSuhiData(base: string = document.baseURI): Promise<SuhiData> {
  const [cities, clusters, spots, citiesByPeriod] = await Promise.all(
    DATA_URLS.map(async (u) => {
      const url = new URL(u, base);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url.pathname}: HTTP ${res.status}`);
      return res.json();
    }),
  );
  return {
    cities: cities as City[],
    clusters: clusters as Cluster[],
    spots: spots as Spots,
    citiesByPeriod: citiesByPeriod as CityPeriod[],
  };
}

export interface DataState {
  data: SuhiData | null;
  error: Error | null;
}

/** `null` data means "still loading"; the rail renders its chrome and no figures until it lands,
 * which is what the original did too (it built the rail only inside the Promise.all callback). */
export function useSuhiData(enabled = true): DataState {
  const [state, setState] = useState<DataState>({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadSuhiData().then(
      (data) => {
        if (live) setState({ data, error: null });
      },
      (error: Error) => {
        if (live) setState({ data: null, error });
      },
    );
    /* StrictMode mounts effects twice. The flag makes the discarded first load a no-op instead
     * of a second setState race; the fetches themselves are cached GETs. */
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}
