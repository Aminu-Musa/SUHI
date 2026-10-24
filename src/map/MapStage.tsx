/* `#map` - the MapLibre stage. Replaces `initMap` (prototype lines 610-648) and the whole
 * `renderSpots()` / `clearLayers()` / `addData()` cycle (lines 722-737).
 *
 * WHAT THE ORIGINAL DID ON EVERY TICK, AND WHAT HAPPENS NOW. A zoom, a filter change, an
 * opacity drag or a year-slider tick each re-ran `activeSpots()`, re-walked 441 polygons'
 * coordinates, tore down both Leaflet layers and re-added them. Here:
 *
 *   contour / cluster / city  ->  setFilter        (expressions.ts `spotFilter`)
 *   opacity, contour nesting  ->  setPaintProperty (`spotFillOpacityExpression`)
 *   year back-cast            ->  setPaintProperty (`spotFillExpression`, ruling 12)
 *   zoom-dependent stroke     ->  nothing; it is a `step` on `['zoom']` (ruling 11)
 *   layer toggles             ->  setLayoutProperty visibility
 *   zoom BUCKET change        ->  setData          (ruling 9, the one unavoidable rebuild)
 *   theme change              ->  setStyle + re-add overlays (paintEpoch)
 *
 * THE MAP IS THE ONLY CONSUMER OF `paintEpoch`. Every other part of the UI repaints because
 * `html[data-theme]` flips and CSS custom properties cascade. MapLibre does not: paint values
 * are resolved hex baked into a parsed style object, and it never re-reads CSS. So the counter
 * in ThemeProvider exists for this component and nothing else. Task 7 owns the repaint TEST;
 * this is the mechanism.
 *
 * NOT IN SCOPE HERE (Task 7), and left as documented seams rather than invented props: the
 * day/night swipe (`positionSwipe`), the hover tooltip (`showTip`), the spot drawer
 * (`openSpot` / `openCity` / `closeDrawer`), and the city circles and labels. Ruling 13 settles
 * that city circles and labels stay DOM overlays, because a MapLibre circle layer cannot be
 * dashed and `.citylabel` is styled text - so `state.layers.cities` and `state.layers.labels`
 * are deliberately NOT read here. They belong to the overlay component that draws them.
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Map as MaplibreMap, addProtocol, setWorkerUrl, type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
/* THE WORKER URL IS WIRED EXPLICITLY, AND WITHOUT IT THE MAP IS BLANK.
 *
 * MapLibre tessellates every source - vector tiles AND GeoJSON - in a web worker, so a worker
 * that fails to load means no tiles and no contour polygons, on a correctly sized canvas, with
 * nothing in the UI to say why. It fails here by default in BOTH modes, for the same reason:
 * maplibre-gl builds its own worker URL as `new URL('./' + name, import.meta.url)` where `name`
 * is chosen at runtime. In `vite dev` the module is pre-bundled into `.vite/deps/`, where no
 * sibling worker file exists (observed: `GET /node_modules/.vite/deps/maplibre-gl-worker.mjs`
 * -> ERR_FAILED, then "Worker failed to load. Check that the worker URL is correct."); in the
 * production build Rollup cannot statically analyse a template-literal specifier, so it emits no
 * worker chunk at all and the built bundle has the same hole. Both were caught by screenshotting
 * the running app - every test in this task still passed.
 *
 * `?worker&url` is the fix rather than `?url`: `maplibre-gl-worker.mjs` imports
 * `./maplibre-gl-shared.mjs`, so handing MapLibre the raw file would just move the 404 one level
 * down. `?worker&url` makes Vite BUNDLE the worker with its imports and return the emitted
 * asset's URL, which is what `setWorkerUrl` wants, and it resolves in dev and in the build. */
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useTheme } from '../app/ThemeProvider';
import { useAppState } from '../app/state';
import type { SuhiData } from '../app/data';
import { BASEMAP_ATTRIBUTION } from './basemap';
import { FIT_BOUNDS } from './nigeria';
import { exagFactor } from './exaggerate';
import { spotSource } from './source';
import {
  NOT_SIGNIFICANT_FILTER,
  SIGNIFICANT_FILTER,
  spotFillExpression,
  spotFillOpacityExpression,
  spotFilter,
  spotLineExpressions,
} from './expressions';
import { MAX_ZOOM, MIN_ZOOM, NATION_LAYER, STATES_LAYER, buildBasemapStyle, type BaseKey } from './style';

/* The pmtiles protocol handler is registered on the maplibregl SINGLETON, so it is per module,
 * not per map. Registering twice throws, and StrictMode mounts every effect twice on purpose -
 * so this is module scope with a latch rather than an effect. */
let protocolAdded = false;
function ensurePmtilesProtocol(): void {
  if (protocolAdded) return;
  protocolAdded = true;
  // Both are global, both are idempotent-once, and both must happen before the first Map.
  setWorkerUrl(maplibreWorkerUrl);
  addProtocol('pmtiles', new Protocol().tile);
}

/**
 * MapLibre needs a WebGL context and THROWS without one, taking the whole React tree with it.
 *
 * Two places that happens. In production: a browser with WebGL disabled or blocklisted, where
 * the honest outcome is the `--ui-panel` ground and a working rail rather than a white page.
 * And in the component suites: jsdom has no WebGL at all, and the rail's twelve suites each
 * render the whole `<App>` - they are about the rail, not the map, and must not need a GPU to
 * run. The brief's rule is that MapLibre is not mocked into a fake integration test, so the map
 * does not pretend to exist in jsdom; it declines to boot, and the expressions and the geometry
 * transforms - where the logic actually lives - are tested as pure functions instead.
 *
 * This is also why `#map`'s font-family and font-size are pinned on `#map` itself in app.css
 * rather than left to `.maplibregl-map`: the fidelity guard measures that selector, and a
 * headless run with no GPU would otherwise leave the container classless.
 */
export function hasWebGl(): boolean {
  /* The interface check comes FIRST so jsdom is answered without touching a canvas: jsdom's
   * getContext is a "not implemented" stub that writes to the virtual console, and twelve rail
   * suites rendering <App> would each print that noise into an otherwise clean run. jsdom
   * defines neither interface, so this short-circuits there and is a real capability check in a
   * browser. */
  if (typeof WebGL2RenderingContext === 'undefined' && typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const SPOT_SOURCE = 'spots';

/** Day under night, as the original's panes were (dayPane 420, nightPane 421). */
export const PERIODS = ['day', 'night'] as const;
export type Period = (typeof PERIODS)[number];

export const fillLayerId = (p: Period) => `spots-${p}-fill`;
export const lineLayerId = (p: Period, significant: boolean) => `spots-${p}-line-${significant ? 'sig' : 'nonsig'}`;

/** Every layer `state.layers.spots` switches. */
export const SPOT_LAYERS: readonly string[] = PERIODS.flatMap((p) => [
  fillLayerId(p),
  lineLayerId(p, true),
  lineLayerId(p, false),
]);

/** Imperative surface for the three zoom buttons and the scope seams, which live in App's markup
 * (`.ovl.ov-tr`, prototype lines 369-372) rather than inside `#map`. A ref rather than a context
 * because there is one map and a handful of callers, and a context would re-render the whole
 * shell on every map event. */
export interface MapApi {
  zoomIn(): void;
  zoomOut(): void;
  /** `fitNation`, prototype lines 649-652. */
  fitNation(): void;
  /** `focusCity`'s map half, prototype lines 818-825. The drawer half is Task 7's. */
  focusCity(city: string): void;
}

export interface MapStageProps {
  readonly data: SuhiData | null;
  readonly baseKey: BaseKey;
  /** Filled on mount so App's zoom buttons can drive the map. */
  readonly api?: RefObject<MapApi | null>;
  /** Ruling 9's disclosure: the active exaggeration factor, pushed out only when it CHANGES.
   * A zoom fires per frame; the factor depends on the bucket, so the bucket is what crosses. */
  readonly onFactorChange?: (factor: number) => void;
}

export function MapStage({ data, baseKey, api, onFactorChange }: MapStageProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<MaplibreMap | null>(null);
  const { theme, paintEpoch } = useTheme();
  const [state] = useAppState();

  /* Read inside effects that must NOT re-run when these change: the paint, filter and
   * visibility effects each own their dependency list, and the style effect would otherwise
   * rebuild the whole basemap every time the opacity slider moved. */
  const latest = useRef({ data, state, theme, baseKey });
  latest.current = { data, state, theme, baseKey };

  const factor = useRef(1);
  /* Our own style-ready latch rather than `m.isStyleLoaded()`, which is `_loaded && every
   * source loaded` - false forever if the basemap archive is unavailable. See the boot effect. */
  const styleReady = useRef(false);

  /* ── the four apply* passes. Each is also called after a setStyle, which is why they are
   *    callbacks over `latest` rather than effect bodies closing over props. ─────────────── */

  const applyPaint = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const { theme: th, state: st } = latest.current;
    const fill = spotFillExpression(th, st.year);
    const opacity = spotFillOpacityExpression(st.contour, st.opacity);
    const line = spotLineExpressions(th);
    for (const p of PERIODS) {
      if (m.getLayer(fillLayerId(p))) {
        m.setPaintProperty(fillLayerId(p), 'fill-color', fill as never);
        m.setPaintProperty(fillLayerId(p), 'fill-opacity', opacity as never);
      }
      for (const significant of [true, false]) {
        const id = lineLayerId(p, significant);
        if (!m.getLayer(id)) continue;
        m.setPaintProperty(id, 'line-color', line.color as never);
        m.setPaintProperty(id, 'line-width', line.width as never);
      }
    }
  }, []);

  const applyFilters = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const { state: st } = latest.current;
    for (const p of PERIODS) {
      const base = spotFilter(p, st.contour, st.cluster, st.city);
      if (m.getLayer(fillLayerId(p))) m.setFilter(fillLayerId(p), base as never);
      for (const significant of [true, false]) {
        const id = lineLayerId(p, significant);
        if (!m.getLayer(id)) continue;
        m.setFilter(id, ['all', base, significant ? SIGNIFICANT_FILTER : NOT_SIGNIFICANT_FILTER] as never);
      }
    }
  }, []);

  const applyVisibility = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const { state: st } = latest.current;
    const set = (id: string, on: boolean) => {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    for (const id of SPOT_LAYERS) set(id, st.layers.spots);
    set(STATES_LAYER, st.layers.states);
    set(NATION_LAYER, st.layers.nation);
  }, []);

  /** Everything that is not part of the basemap style: added on boot and again after every
   * setStyle, because setStyle replaces the style object and with it every layer we added. */
  const addOverlays = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const { theme: th, state: st, data: d } = latest.current;
    const line = spotLineExpressions(th);

    /* The `states` and `nation` layers are NOT added here. Both draw the basemap's own
     * `boundaries` source-layer (state boundaries by the user's 2026-10-24 reversal of ruling
     * 31, the national outline by ruling 30), so they belong to the style, not to the overlays -
     * see the bottom of `buildBasemapStyle`. `applyVisibility` still switches them by id. */
    if (!d) return;
    if (!m.getSource(SPOT_SOURCE)) {
      m.addSource(SPOT_SOURCE, { type: 'geojson', data: spotSource(d.spots, factor.current) as never });
    }
    for (const p of PERIODS) {
      const base = spotFilter(p, st.contour, st.cluster, st.city);
      if (!m.getLayer(fillLayerId(p))) {
        m.addLayer({
          id: fillLayerId(p),
          type: 'fill',
          source: SPOT_SOURCE,
          filter: base as never,
          paint: {
            'fill-color': spotFillExpression(th, st.year) as never,
            'fill-opacity': spotFillOpacityExpression(st.contour, st.opacity) as never,
          },
        });
      }
      /* TWO line layers per period, and the split is forced rather than chosen:
       * `line-dasharray` is a cross-faded style property, so it takes zoom expressions and NOT
       * feature expressions - `bh_significant` cannot pick a dash pattern inside one layer. See
       * `spotLineExpressions`. */
      for (const significant of [true, false]) {
        const id = lineLayerId(p, significant);
        if (m.getLayer(id)) continue;
        m.addLayer({
          id,
          type: 'line',
          source: SPOT_SOURCE,
          filter: ['all', base, significant ? SIGNIFICANT_FILTER : NOT_SIGNIFICANT_FILTER] as never,
          paint: {
            'line-color': line.color as never,
            'line-width': line.width as never,
            ...(significant ? {} : { 'line-dasharray': [...line.dasharray] }),
          },
        });
      }
    }
  }, []);

  /** Prototype line 651: padding 16, no animation. */
  const fit = useCallback((m: MaplibreMap) => {
    m.fitBounds(FIT_BOUNDS as unknown as LngLatBoundsLike, { padding: 16, animate: false });
  }, []);

  /** Ruling 9. Re-asks the bucket and, only if it moved, re-walks the geometry through setData. */
  const pushFactor = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const next = exagFactor(m.getZoom(), latest.current.state.layers.exag);
    if (next === factor.current) return;
    factor.current = next;
    const src = m.getSource(SPOT_SOURCE) as GeoJSONSource | undefined;
    const d = latest.current.data;
    if (src && d) src.setData(spotSource(d.spots, next) as never);
    onFactorChange?.(next);
  }, [onFactorChange]);

  /* ── boot ──────────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!host.current || map.current) return;
    if (!hasWebGl()) return;
    ensurePmtilesProtocol();
    const { theme: th, baseKey: bk } = latest.current;
    const container = host.current;
    const m = new MaplibreMap({
      container,
      style: buildBasemapStyle(th, bk) as never,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      /* Prototype line 610: `zoomControl: false, attributionControl: true`. MapLibre's zoom
       * control is opt-in, so only attribution is asked for - the original's own `#zin`/`#zout`
       * buttons ARE the control, and a second one in the corner would be a visible addition. */
      attributionControl: { compact: false, customAttribution: BASEMAP_ATTRIBUTION },
      // Leaflet cannot rotate, so bearing and pitch gestures would be new interactions rather
      // than transcribed ones.
      dragRotate: false,
      pitchWithRotate: false,
      /* THE INITIAL VIEW IS THE ORIGINAL'S RENDERED VIEW, WHICH IS minZoom - NOT ITS fitBounds.
       * This is measured, not assumed. The original does `setView([9.1, 8.7], 5.6)` and then
       * `fitNation()` (prototype lines 612, 647), but `initMap` runs fitBounds before the
       * container has been measured - the 140 ms `invalidateSize` interval on lines 638-646 is
       * there because of that - so Leaflet's `getBoundsZoom` works from a stale size, falls
       * below minZoom and clamps to 5. The approved page therefore boots at zoom 5 with
       * `#zoomHint` reading "scaled x9", which is what spec §3 makes the authority, and the
       * probe behind the §9.1-style note in the task 6 report measured `.ovl` at 564.25 px in
       * both themes because of it. A correctly fitted boot lands at 6.47, factor 6, and a
       * 331.53 px `.ovl` - a visible difference, in the first frame, with no sanction.
       *
       * `fitNation` below is NOT bent to match: it really fits, exactly as the original's own
       * `Fit` button does once the container has a size. Only the FIRST frame is transcribed. */
      center: [8.7, 9.1],
      zoom: MIN_ZOOM,
      fadeDuration: 0,
    });
    map.current = m;
    /* DEV-ONLY HANDLE. `import.meta.env.DEV` is statically false in a production build, so Rollup
     * removes this branch entirely - the shipped bundle has no global. It exists because the map
     * is the one part of this app that cannot be inspected from the DOM: verifying what the
     * basemap's `boundaries` source-layer actually contains, or which spots a filter selects,
     * means asking MapLibre, and there is no other way in. */
    if (import.meta.env.DEV) (globalThis as unknown as Record<string, unknown>).__suhiMap = m;
    m.touchZoomRotate.disableRotation();

    /* NOT `m.on('load')`, AND THE DIFFERENCE IS LOAD-BEARING. MapLibre's `load` fires only once
     * the style AND every source's metadata have resolved, so a basemap archive that 404s, or
     * is served without range-request support, means `load` never fires - and the contour
     * polygons and the zoom hint would both be waiting behind a basemap they do not need. The fidelity guard found this as a race before it could be found as an outage:
     * Nocturne passed and Modernist failed on `.ovl width: 564.25 vs 355.81`, which is the zoom
     * hint still reading "true extent" because the factor had not been pushed yet.
     *
     * So: the camera and the factor are set SYNCHRONOUSLY, and the overlays go in on
     * `styledata` - which fires when the style JSON is parsed, before any tile request. Our
     * data is then independent of the basemap's availability, which is also the honest
     * dependency direction: the contours are the deliverable and the basemap is context. */
    m.on('styledata', () => {
      styleReady.current = true;
      addOverlays();
      applyVisibility();
    });
    pushFactor();
    // `zoomend` in the original (line 627) re-rendered everything; here only a bucket change does.
    m.on('zoom', pushFactor);

    /* Replaces TWO pieces of the original: the 140 ms polling interval that waited for
     * `#mapwrap` to have a size (lines 638-646) and the 240 ms timeout after `#frameToggle`
     * (line 1009). A ResizeObserver is the same answer to both, fires once per actual change
     * instead of 250 times, and leaves no timer running in a hidden document. */
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [addOverlays, applyVisibility, pushFactor]);

  /* ── the imperative surface App's zoom buttons use ─────────────────────────────────────── */
  useEffect(() => {
    if (!api) return;
    const ref = api;
    ref.current = {
      zoomIn: () => map.current?.zoomIn(),
      zoomOut: () => map.current?.zoomOut(),
      fitNation: () => {
        const m = map.current;
        if (m) fit(m);
      },
      focusCity: (city: string) => {
        const m = map.current;
        const d = latest.current.data;
        if (!m || !d) return;
        /* Prototype lines 820-823: the bounds of that city's spots, padded 60%, maxZoom 13.
         * Computed from the UNEXAGGERATED geometry - the exaggerated shapes are a display
         * device, and framing on them would zoom differently in every bucket. */
        let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
        for (const f of d.spots.features) {
          if (f.properties.city !== city) continue;
          walkCoords(f.geometry.coordinates, (lon, lat) => {
            if (lon < w) w = lon;
            if (lon > e) e = lon;
            if (lat < s) s = lat;
            if (lat > n) n = lat;
          });
        }
        if (!Number.isFinite(w)) return;
        const px = (e - w) * 0.6;
        const py = (n - s) * 0.6;
        m.fitBounds([[w - px, s - py], [e + px, n + py]], { animate: false, maxZoom: 13 });
      },
    };
    return () => {
      ref.current = null;
    };
  }, [api, fit]);

  /* ── theme / basemap: rebuild the style, then put the overlays back ────────────────────── */
  const booted = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    /* Skip the first run: boot already built the style with this theme, and a setStyle here
     * would throw away the layers `load` is about to add. StrictMode's double mount makes that
     * a real case, not a theoretical one. */
    if (!booted.current) {
      booted.current = true;
      return;
    }
    styleReady.current = false;
    m.setStyle(buildBasemapStyle(theme, baseKey) as never, { diff: false });
    /* The boot effect's `styledata` listener re-adds the overlays (it was registered first, so
     * it runs first); this one re-applies the passes that depend on state the new style does
     * not carry. */
    m.once('styledata', () => {
      applyPaint();
      applyFilters();
      applyVisibility();
    });
    /* `paintEpoch` IS the subscription, and it is in this list on purpose even though `theme`
     * changes with it: the counter is what says "CSS-resolved paint is stale", and a future
     * repaint trigger that is not a theme change (a token edit in dev, say) would bump only the
     * counter. Removing it would silently drop the mechanism. */
  }, [theme, paintEpoch, baseKey, addOverlays, applyPaint, applyFilters, applyVisibility]);

  useEffect(applyPaint, [applyPaint, theme, paintEpoch, state.year, state.contour, state.opacity, data]);
  useEffect(applyFilters, [applyFilters, state.contour, state.cluster, state.city, data]);
  useEffect(applyVisibility, [applyVisibility, state.layers, data]);

  /* ── ruling 9: the exaggeration toggle, and the data arriving after `load` ─────────────── */
  useEffect(() => {
    const m = map.current;
    if (!m || !data) return;
    if (!m.getSource(SPOT_SOURCE)) {
      /* The data landed after the style. `styleReady` rather than `isStyleLoaded()` or an
       * `idle` wait, both of which depend on every SOURCE having loaded - so an unavailable
       * basemap would mean the contours never get added at all. */
      if (styleReady.current) {
        addOverlays();
        applyVisibility();
      } else {
        m.once('styledata', () => {
          addOverlays();
          applyVisibility();
        });
      }
      return;
    }
    /* `state.layers.exag` changes the factor without the zoom moving, so the bucket comparison
     * has to be re-asked here rather than waited for on a zoom event. */
    const next = exagFactor(m.getZoom(), state.layers.exag);
    if (next !== factor.current) {
      factor.current = next;
      onFactorChange?.(next);
    }
    const src = m.getSource(SPOT_SOURCE) as GeoJSONSource | undefined;
    if (src) src.setData(spotSource(data.spots, factor.current) as never);
  }, [data, state.layers.exag, addOverlays, applyVisibility, onFactorChange]);

  /* `#map` keeps its id and its `position:absolute; inset:0` from app.css. MapLibre adds
   * `.maplibregl-map` to it; app.css carries the matching container rules next to the
   * `.leaflet-container` ones it transcribed. */
  return <div id="map" ref={host} />;
}

/** Depth-first walk of any GeoJSON coordinate nesting. */
function walkCoords(a: unknown, visit: (lon: number, lat: number) => void): void {
  const arr = a as unknown[];
  if (!Array.isArray(arr)) return;
  if (Array.isArray(arr[0])) {
    for (const inner of arr) walkCoords(inner, visit);
    return;
  }
  visit(arr[0] as number, arr[1] as number);
}
