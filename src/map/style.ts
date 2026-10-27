/* Spec §8.3 - THE BASEMAP JOINS THE DESIGN SYSTEM. The whole MapLibre style JSON, built from
 * `THEME_TOKENS`.
 *
 * Nothing here is a hex literal and nothing here is a `var()`. Every colour is a token name
 * resolved through `token()` at build time, so roads, water, landuse and the national outline
 * flip with `data-theme` exactly like the rest of the UI - and because MapLibre bakes paint
 * values into a parsed style object and never re-reads CSS, "flip" means the style is rebuilt.
 * `useTheme().paintEpoch` is the signal that makes that happen (see `MapStage.tsx`).
 *
 * RULING 29 replaced the five Esri raster basemaps. `BASEMAP_VARIANTS` below is the revision of
 * what the basemap segment offers, and it is a sanctioned visible departure with an
 * `ALLOWED_DIFFS` entry citing spec §8.3 - the first exemption authorised by the user rather
 * than by §3 or §9.1. See `src/rail/BasemapSeg.tsx` for the segment itself.
 *
 * RULING 30: the national outline is the basemap's OWN `boundaries` source-layer at
 * `kind == 'country'`, drawn in `--ui-line-strong` at 2 px - the exact style the original gave
 * the world-atlas outline (prototype line 621) - so dropping the CDN costs nothing visually.
 *
 * NO SYMBOL LAYERS, AND THEREFORE NO `glyphs`. A MapLibre symbol layer needs a glyph endpoint,
 * and the only ready one is a Protomaps CDN - which would put back the third-party map
 * dependency rulings 29 and 30 exist to remove, for labels the design does not render from the
 * basemap anyway: ruling 13 keeps city labels as DOM overlays (`.citylabel`, Task 7), and the
 * `labels` layer toggle controls those. So place names come from our data through the DOM, where
 * they are already styled by `--color-text` and already flip with the theme.
 *
 * SOURCE-LAYER NAMES ARE MEASURED FROM THE ARCHIVE, not taken from the schema docs. A layer
 * naming a source-layer the archive does not contain renders NOTHING and reports nothing - it
 * degrades to a blank ground instead of a broken map, which is good for resilience and terrible
 * for noticing a typo. `SOURCE_LAYERS` below records what the archive actually carries and
 * `style.test.ts` holds every layer to it.
 */

import { BASEMAP_ATTRIBUTION, BASEMAP_SOURCE, basemapSourceUrl } from './basemap';
import { EMPTY_STATES, STATES_ATTRIBUTION, STATES_SOURCE } from './boundaries';
import { EXTRACT_BBOX } from './nigeria';
import { token } from './expressions';
import type { Theme } from '../app/ThemeProvider';

/* RULING 39 (user, 2026-10-26): TWO variants, and both palettes FIXED.
 *
 * Ruling 29 offered three - dark, topo, and a `plain` that followed `data-theme` at reduced
 * detail. Measured on the live app, Dark and Plain differed by **209 pixels out of 864,000** in
 * Nocturne: `palette: 'theme'` resolves to nocturne in that theme, so the palettes were identical
 * and the only difference left was detail the national zoom does not draw. Two of three options
 * were the same picture, and the user reasonably read the control as broken. (Topo differed by
 * 94.8%, so the wiring was never the problem.)
 *
 * Fixed palettes are the property that scheme lacked: `dark` and `light` differ from each other
 * whatever the UI theme is doing. It is also nearer what the original's five Esri options really
 * offered - Dark Gray / Topo / Shaded Relief / Light Gray / Imagery is two grounds and three
 * textures, and the choice that mattered was the ground.
 *
 * Ruling 7's latch reads properly now: a theme change drags the basemap by key until the reader
 * picks one, and `nocturne -> dark`, `modernist -> light` says what it does. `modernist -> topo`
 * only worked if you knew Topo happened to use the light palette.
 *
 * `palette: 'theme'` and `detail: 'ground'` are gone with `plain`; both existed only to serve it. */
export interface BasemapVariant {
  /** `label.split(' ')[1]` is the button's text, as in the original (prototype line 665). */
  readonly label: string;
  readonly palette: Theme;
}

export const BASEMAP_VARIANTS = {
  dark: { label: 'Vector Dark', palette: 'nocturne' },
  light: { label: 'Vector Light', palette: 'modernist' },
} as const satisfies Record<string, BasemapVariant>;

export type BaseKey = keyof typeof BASEMAP_VARIANTS;

export const BASE_KEYS = Object.keys(BASEMAP_VARIANTS) as BaseKey[];

/** The source-layers this style reads, MEASURED from the archive's own TileJSON metadata rather
 * than taken from the Protomaps schema docs. The archive carries `boundaries`, `buildings`,
 * `earth`, `landcover`, `landuse`, `places`, `pois`, `roads` and `water` - and NOT
 * `physical_line`, which an earlier version of this style referenced and which would have
 * rendered nothing, silently, because MapLibre treats an unknown source-layer as empty rather
 * than as an error. `style.test.ts` holds this set, so a future re-cut that changes the schema
 * fails a test instead of blanking a layer. */
export const SOURCE_LAYERS = ['earth', 'landcover', 'landuse', 'water', 'roads', 'boundaries'] as const;

/* The two layer ids the rail's `states` and `nation` toggles switch. They are part of the
 * basemap style rather than overlays because both are drawn from the basemap's own
 * `boundaries` source-layer - see the two layers at the bottom of `buildBasemapStyle`. */
export const STATES_LAYER = 'states';
export const NATION_LAYER = 'nation';

/** Prototype line 610: `minZoom: 5, maxZoom: 16`. The archive stops at z10 and vector tiles
 * upscale without blurring, so `maxzoom` on the SOURCE is what lets the map keep zooming. */
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 16;
export const SOURCE_MAX_ZOOM = 10;

/** Which palette a variant paints with, under the active UI theme. */
export function variantTheme(key: BaseKey, theme: Theme): Theme {
  /* Both palettes are fixed now (ruling 39), so the active UI theme does not enter into it. The
   * parameter stays for call-site symmetry with the other style builders. */
  void theme;
  return BASEMAP_VARIANTS[key].palette;
}

type Layer = Record<string, unknown>;

/**
 * The style JSON. `theme` is the ACTIVE UI theme; `base` is the reader's basemap key, which
 * decides the palette and whether roads and landuse are drawn at all.
 *
 * Only the basemap's own layers are here. The spot layers, the graticule and the city overlays
 * are added imperatively in `MapStage`, because they depend on data that arrives after the map.
 */
export function buildBasemapStyle(theme: Theme, base: BaseKey = 'dark', baseUrl?: string): Record<string, unknown> {
  const t = variantTheme(base, theme);
  const c = (name: string) => token(t, name);
  /* RULING 39 removed `detail: 'ground'`; every variant draws full detail. */
  const ground = false;

  const layers: Layer[] = [
    /* The ground the whole map sits on. app.css gives `.leaflet-container` (and now
     * `.maplibregl-map`) `background: var(--ui-panel)`, but a MapLibre canvas paints over its
     * container, so the same token has to be a `background` layer too or the panel colour would
     * only show through where tiles are missing. */
    { id: 'bg', type: 'background', paint: { 'background-color': c('--ui-panel') } },
    /* Land. One step off the ground in the same neutral family, so the coast and the Lake Chad
     * shore read without land becoming a second surface competing with the contours. */
    {
      id: 'earth',
      type: 'fill',
      source: BASEMAP_SOURCE,
      'source-layer': 'earth',
      paint: { 'fill-color': c('--ui-panel-2') },
    },
  ];

  if (!ground) {
    layers.push({
      id: 'landuse',
      type: 'fill',
      source: BASEMAP_SOURCE,
      'source-layer': 'landcover',
      /* `landcover` carries only `kind`, and these are the five values that mean "vegetated or
       * bare ground" in the Protomaps schema. Built-up land is deliberately NOT tinted: the
       * contours are the figure and a city-shaped patch of colour under them would compete with
       * the encoding. */
      filter: ['match', ['get', 'kind'], ['forest', 'grassland', 'scrub', 'barren', 'farmland'], true, false],
      paint: { 'fill-color': c('--color-surface'), 'fill-opacity': 0.55 },
    });
  }

  layers.push(
    {
      id: 'water',
      type: 'fill',
      source: BASEMAP_SOURCE,
      'source-layer': 'water',
      paint: { 'fill-color': c('--color-bg') },
    },
    /* Rivers and streams are POLYGONS in the `water` layer at these zooms, so there is no
     * separate line layer to draw - the archive carries no `physical_line`. What the hairline
     * does instead is give every water body a defined edge against the land fill, which is the
     * same job `--ui-line` does for every panel in the UI. */
    {
      id: 'water-line',
      type: 'line',
      source: BASEMAP_SOURCE,
      'source-layer': 'water',
      paint: { 'line-color': c('--color-bg'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 14, 2] },
    },
  );

  if (!ground) {
    layers.push(
      /* Three weights off `kind`, which is the whole road hierarchy the extract carries at these
       * zooms. `--ui-line` is the hairline token the rest of the UI rules with, so the road
       * network reads as the same system's rules rather than as a second graphic language. */
      {
        id: 'roads-minor',
        type: 'line',
        source: BASEMAP_SOURCE,
        'source-layer': 'roads',
        filter: ['match', ['get', 'kind'], ['minor_road', 'path', 'other'], true, false],
        minzoom: 11,
        paint: { 'line-color': c('--ui-line'), 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 1.6] },
      },
      {
        id: 'roads-medium',
        type: 'line',
        source: BASEMAP_SOURCE,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'medium_road'],
        minzoom: 8,
        paint: { 'line-color': c('--ui-line'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 2.4] },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: BASEMAP_SOURCE,
        'source-layer': 'roads',
        filter: ['match', ['get', 'kind'], ['highway', 'major_road'], true, false],
        paint: {
          'line-color': c('--ui-line-strong'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1.4, 16, 3.4],
        },
      },
    );
  }

  /* THE TWO BOUNDARY LAYERS - the two the rail's toggles already name, "State boundaries" and
   * "National boundary". They now come from DIFFERENT SOURCES, and that is the point.
   *
   * ══ STATE BOUNDARIES: data/boundaries/nga-adm1.topojson, NOT the basemap (TASK 12) ══
   *
   * The history in three steps. The original drew a `d3.geoGraticule` at 1.6 degree steps and
   * admitted it - the layer's chip read `T('placeholder')` - with Nigeria's bounding RECTANGLE
   * as its extent, which is §9.1 bug 6: lines over Niger, Cameroon, Benin and the sea. The
   * user's 2026-10-24 reversal of ruling 31 swapped it for the basemap's own `boundaries`
   * source-layer at `kind: 'region'`, real admin-level-1 lines - which deleted the graticule but
   * NOT the extent problem, because those features carry no country code, name or ISO field at
   * any zoom in this extract. There was nothing to filter on, so the neighbours' first-level
   * divisions rendered too. Task 6 reported that rather than clipping it.
   *
   * It now draws `STATES_SOURCE`, which is Nigeria-only BY CONSTRUCTION: 37 features, every one
   * `shapeGroup: NGA`, validated against the shipped bytes in src/map/boundaries.ts. There is no
   * filter here at all - not a loosened one, none - because the file contains nothing to exclude,
   * and a filter over a field every feature shares is a decoration that reads as a safeguard.
   *
   * The source is declared with EMPTY data and filled by `setData` once the fetch lands (see
   * MapStage's `applyBoundaries`). The style is built before any data exists and is rebuilt on
   * every theme and basemap change, so inlining the geometry here would mean re-serialising a
   * megabyte of polygons on every theme flip.
   *
   * The TREATMENT is unchanged and still the original's exactly: `--ui-muted`, 1 px, opacity .5,
   * dashed `3 4` (prototype line 625). That is what keeps it subordinate to the 2 px
   * `--ui-line-strong` border below - the reading the original had, and the one the data now
   * deserves. A state line is a real boundary, but it is not the border.
   *
   * ══ NATIONAL BOUNDARY: still the basemap's own, RULING 30 ══
   *
   * `--ui-line-strong` at 2 px, opacity .9, is exactly what the original styled its world-atlas
   * outline with (prototype line 621), and the basemap's `kind: 'country'` line already is that
   * outline. Drawing it from the ADM1 file instead would mean dissolving 37 polygons into one at
   * runtime for a line that is correct already. It is pushed LAST so it paints over the state
   * lines where the two coincide, which they do along the whole frontier. */
  layers.push(
    {
      id: STATES_LAYER,
      type: 'line',
      source: STATES_SOURCE,
      paint: {
        'line-color': c('--ui-muted'),
        'line-width': 1,
        'line-opacity': 0.5,
        'line-dasharray': [3, 4],
      },
    },
    {
      id: NATION_LAYER,
      type: 'line',
      source: BASEMAP_SOURCE,
      'source-layer': 'boundaries',
      filter: ['==', ['get', 'kind'], 'country'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c('--ui-line-strong'), 'line-width': 2, 'line-opacity': 0.9 },
    },
  );

  return {
    version: 8,
    name: `SUHI Nigeria · ${BASEMAP_VARIANTS[base].label}`,
    sources: {
      [BASEMAP_SOURCE]: {
        type: 'vector',
        url: basemapSourceUrl(baseUrl),
        attribution: BASEMAP_ATTRIBUTION,
        maxzoom: SOURCE_MAX_ZOOM,
        bounds: [...EXTRACT_BBOX],
      },
      /* Declared empty; `MapStage.applyBoundaries` sets the real collection. geoBoundaries is
       * ODC-ODbL, so the attribution is a licence condition rather than a courtesy - and it
       * belongs on the source that carries the data, which is how MapLibre's attribution control
       * collects it. */
      [STATES_SOURCE]: {
        type: 'geojson',
        data: EMPTY_STATES,
        attribution: STATES_ATTRIBUTION,
      },
    },
    layers,
  };
}
