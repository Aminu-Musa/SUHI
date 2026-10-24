/* RULING 29 - THE BASEMAP URL LIVES IN EXACTLY ONE PLACE.
 *
 * Spec §8.3: five Esri raster basemaps sat under two design systems and belonged to neither, so
 * they are replaced by a self-hosted Protomaps VECTOR basemap styled from our own tokens. §8.6
 * then caps a Cloudflare Pages file at 25 MiB, and a Nigeria extract that reaches the map's
 * `maxZoom: 16` is far past that (measured: 39.23 MB at a z10 ceiling, 163 MB at z12), so the
 * user chose Cloudflare R2 with a small Worker. Development reads a local file instead.
 *
 * Dev and prod therefore differ by CONFIGURATION, NOT CODE, and this module is the only thing
 * that knows either value:
 *
 *   VITE_BASEMAP_URL=https://<r2-worker-host>/nigeria.pmtiles   (production)
 *   unset                                                       (development, local file)
 *
 * Rebuild the local asset with (spec §8.3; `--bbox` is EXTRACT_BBOX in nigeria.ts):
 *
 *   pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles public/nigeria-z10.pmtiles \
 *     --bbox=2.5,3.9,15.0,14.1 --maxzoom=10
 *
 * The file is gitignored (`*.pmtiles`): 39 MB does not belong in git, and §8.3 records that an
 * extract cannot be re-cut to a lower ceiling from its own output, so every ceiling costs a
 * fresh fetch from source.
 */

/** The development filename, under `public/`, resolved against the page. */
export const BASEMAP_FILE = 'nigeria-z10.pmtiles';

/** `pmtiles://` tells MapLibre to route the request through the registered Protocol. */
export const PMTILES_SCHEME = 'pmtiles://';

/** The one id the style and every layer refer to. */
export const BASEMAP_SOURCE = 'basemap';

/** Protomaps serves OpenStreetMap data; both have to be credited. */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>';

/**
 * The archive URL. `document.baseURI` is the resolution base rather than an absolute `/` path,
 * for the same reason `src/app/data.ts` resolves its three data files that way: the built page is
 * served from `/dist/index.html` by the fidelity harness and from the site root in production,
 * and Vite copies `public/` next to the entry in both. An absolute `/nigeria-z10.pmtiles` would
 * be correct in exactly one of those.
 */
export function basemapUrl(base: string = document.baseURI): string {
  const configured = import.meta.env.VITE_BASEMAP_URL;
  if (configured) return configured;
  return new URL(BASEMAP_FILE, base).href;
}

/** What goes in the style's `sources`. */
export function basemapSourceUrl(base?: string): string {
  return PMTILES_SCHEME + basemapUrl(base);
}
