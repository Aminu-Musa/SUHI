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
 * in ThemeProvider exists for this component and nothing else - and it has to reach BOTH map
 * instances, which is new with ruling 35. `theme-repaint.test.ts` pins that.
 *
 * ══ RULING 35 - THERE ARE TWO MAPS, AND THE SWIPE IS WHY ══
 *
 * `positionSwipe` (lines 838-850) clipped Leaflet's `dayPane` and `nightPane`: two DOM elements
 * holding two SVG overlays, each independently clippable, which is what let the original cut a
 * polygon MID-GEOMETRY at the swipe line. MapLibre renders every layer into ONE canvas, so
 * there is no element to clip that contains only the night spots. Filtering by longitude was
 * rejected (it pops whole polygons rather than cutting them), and re-splitting the GeoJSON per
 * frame was rejected (it is the Leaflet problem §8.2 exists to escape).
 *
 * So: `#map` holds the DAY instance and `#mapNight` the NIGHT one, stacked on top and clipped
 * with CSS `clip-path` (Swipe.tsx computes the inset, this component applies it). Each instance
 * carries only its own period's three layers - there is no point tessellating 225 day polygons
 * into a canvas that will never show them - and the two are kept in sync on `move`.
 *
 * THE COST IS TWO WEBGL CONTEXTS AND TWO COPIES OF THE SPOT SOURCE. Measured numbers are in the
 * task 7 report. The basemap tiles come from one PMTiles archive through the browser cache, so
 * the second instance costs GPU and memory rather than bandwidth. The fallback, if it ever has
 * to be taken, is one instance and a longitude filter - whole-polygon reveals instead of
 * mid-polygon cuts, which is a visible fidelity loss and therefore the fallback and not the plan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MaplibreMap, addProtocol, setWorkerUrl, type GeoJSONSource, type LngLatBoundsLike, type MapMouseEvent } from 'maplibre-gl';
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
import type { SpotProperties, SuhiData } from '../app/data';
import { BASEMAP_ATTRIBUTION } from './basemap';
import { STATES_SOURCE, loadStateBoundaries, type StateCollection } from './boundaries';
import { FIT_BOUNDS } from './nigeria';
import { exagFactor } from './exaggerate';
import { spotSource } from './source';
/* The layer set and its paint live in `paint.ts` as pure data, so that `addLayer` and
 * `setPaintProperty` read from ONE derivation - which is what makes Review Focus 4's repaint
 * testable without a WebGL context. See that file's header. */
import {
  PERIODS,
  SPOT_LAYERS,
  SPOT_SOURCE,
  fillLayerId,
  layerFilter,
  layerPaint,
  lineLayerId,
  overlayLayers,
  periodLayers,
  repaintPatch,
  type Period,
} from './paint';
import { MAX_ZOOM, MIN_ZOOM, NATION_LAYER, STATES_LAYER, buildBasemapStyle, type BaseKey } from './style';
import { CityCircles } from './CityCircles';
import { useInteractions } from './interactions';
import { swipeGeometry } from './Swipe';

/* The pmtiles protocol handler is registered on the maplibregl SINGLETON, so it is per module,
 * not per map. Registering twice throws, and StrictMode mounts every effect twice on purpose -
 * so this is module scope with a latch rather than an effect. It is also why TWO map instances
 * cost nothing extra here: the protocol and the worker URL are global, registered once. */
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

/* Re-exported so a reader who starts at the map component finds the ids and the period type
 * where they expect them; `paint.ts` is where they are declared. */
export { PERIODS, SPOT_LAYERS, SPOT_SOURCE, fillLayerId, lineLayerId, periodLayers };
export type { Period };

/** Imperative surface for the three zoom buttons and the scope seams, which live in App's markup
 * (`.ovl.ov-tr`, prototype lines 369-372) rather than inside `#map`. A ref rather than a context
 * value because a context value would re-render the whole shell on every map event; the ref
 * itself is carried BY the interactions context, because `focusCity` needs the camera and the
 * drawer in one call (see interactions.tsx).
 *
 * Every method drives the DAY instance only. The night one follows through the `move` sync, so
 * a second call would be a second animation racing the first. */
export interface MapApi {
  zoomIn(): void;
  zoomOut(): void;
  /** `fitNation`, prototype lines 649-652. */
  fitNation(): void;
  /** `focusCity`'s map half, prototype lines 818-825. The scope and the drawer are the
   * interactions context's (`focusCity` there calls this). */
  focusCity(city: string): void;
}

export interface MapStageProps {
  readonly data: SuhiData | null;
  readonly baseKey: BaseKey;
  /** Ruling 9's disclosure: the active exaggeration factor, pushed out only when it CHANGES.
   * A zoom fires per frame; the factor depends on the bucket, so the bucket is what crosses. */
  readonly onFactorChange?: (factor: number) => void;
}

interface Instance {
  readonly map: MaplibreMap;
  readonly period: Period;
}

export function MapStage({ data, baseKey, onFactorChange }: MapStageProps) {
  const dayHost = useRef<HTMLDivElement | null>(null);
  const nightHost = useRef<HTMLDivElement | null>(null);
  const instances = useRef<Instance[]>([]);
  /* The day instance as STATE as well as in the ref, because `CityCircles` has to re-run
   * `map.project()` the moment the map exists and a ref assignment does not re-render. */
  const [dayMap, setDayMap] = useState<MaplibreMap | null>(null);
  const { theme, paintEpoch } = useTheme();
  const [state] = useAppState();
  const { mapApi, showTip, hideTip, openSpot, closeDrawer, swipePct } = useInteractions();

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
   *    callbacks over `latest` rather than effect bodies closing over props. Each now runs over
   *    EVERY instance: a pass that reached only the day map would leave the night side on the
   *    previous theme, filter or opacity, and the swipe would show the difference. ───────── */

  const applyPaint = useCallback(() => {
    const { theme: th, state: st } = latest.current;
    for (const { map: m, period } of instances.current) {
      for (const layer of overlayLayers()) {
        if (layer.period !== period || !m.getLayer(layer.id)) continue;
        const patch = repaintPatch(layer, th, st);
        for (const key of Object.keys(patch)) m.setPaintProperty(layer.id, key as never, patch[key] as never);
      }
    }
  }, []);

  const applyFilters = useCallback(() => {
    const { state: st } = latest.current;
    for (const { map: m, period } of instances.current) {
      for (const layer of overlayLayers()) {
        if (layer.period !== period || !m.getLayer(layer.id)) continue;
        m.setFilter(layer.id, layerFilter(layer, st.contour, st.cluster, st.city) as never);
      }
    }
  }, []);

  const applyVisibility = useCallback(() => {
    const { state: st } = latest.current;
    for (const { map: m, period } of instances.current) {
      const set = (id: string, on: boolean) => {
        if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      };
      for (const id of periodLayers(period)) set(id, st.layers.spots);
      set(STATES_LAYER, st.layers.states);
      set(NATION_LAYER, st.layers.nation);
    }
  }, []);

  /** TASK 12 - the state boundaries, pushed into the style's empty `STATES_SOURCE`.
   *
   * The geometry is fetched once (the effect below) and kept in a ref, because it has to be
   * re-set after every `setStyle`: a style rebuild on a theme or basemap change replaces the
   * source object with the empty collection the style declares, and the state lines would
   * silently vanish on the first theme flip. That is the same shape as `addOverlays` and it is
   * called from the same two places - the `styledata` handler and the fetch's own resolution.
   *
   * `setData` rather than inlining into `buildBasemapStyle`: the style is rebuilt on every theme
   * and basemap change, and re-serialising ~1 MB of expanded polygons each time is work the
   * reader can feel. */
  const states = useRef<StateCollection | null>(null);
  const applyBoundaries = useCallback((only?: MaplibreMap) => {
    const fc = states.current;
    if (!fc) return;
    for (const { map: m } of instances.current) {
      if (only && m !== only) continue;
      const src = m.getSource(STATES_SOURCE) as GeoJSONSource | undefined;
      if (src) src.setData(fc as never);
    }
  }, []);

  /** Everything that is not part of the basemap style: added on boot and again after every
   * setStyle, because setStyle replaces the style object and with it every layer we added. */
  const addOverlays = useCallback((only?: MaplibreMap) => {
    const { theme: th, state: st, data: d } = latest.current;
    if (!d) return;

    for (const { map: m, period } of instances.current) {
      if (only && m !== only) continue;
      /* The `states` and `nation` LAYERS are NOT added here - both are declared in the style
       * (see the bottom of `buildBasemapStyle`), so their order relative to the basemap's own
       * water, landuse and roads is fixed by the style rather than by the order overlays happen
       * to be added in. `nation` draws the basemap's own `boundaries` source-layer (ruling 30);
       * `states` draws `STATES_SOURCE`, whose DATA is pushed by `applyBoundaries` rather than
       * here, because it arrives from its own fetch on its own schedule. `applyVisibility`
       * switches both by id. */
      if (!m.getSource(SPOT_SOURCE)) {
        m.addSource(SPOT_SOURCE, { type: 'geojson', data: spotSource(d.spots, factor.current) as never });
      }
      /* ONE PERIOD PER INSTANCE (ruling 35). The day instance never draws night spots and vice
       * versa, so the layers the other instance owns are simply absent rather than hidden -
       * which is also why `applyVisibility` loops `periodLayers(period)` and not `SPOT_LAYERS`.
       *
       * TWO line layers per period, and the split is forced rather than chosen:
       * `line-dasharray` is a cross-faded style property, so it takes zoom expressions and NOT
       * feature expressions - `bh_significant` cannot pick a dash pattern inside one layer. See
       * `spotLineExpressions`.
       *
       * The paint comes from `layerPaint`, which is the SAME derivation `applyPaint` re-sets
       * from. That is Review Focus 4's fix: there is no second copy to forget. */
      for (const layer of overlayLayers()) {
        if (layer.period !== period || m.getLayer(layer.id)) continue;
        m.addLayer({
          id: layer.id,
          type: layer.type,
          source: SPOT_SOURCE,
          filter: layerFilter(layer, st.contour, st.cluster, st.city) as never,
          paint: layerPaint(layer, th, st) as never,
        } as never);
      }
    }
  }, []);

  /** Prototype line 651: padding 16, no animation. */
  const fit = useCallback((m: MaplibreMap) => {
    m.fitBounds(FIT_BOUNDS as unknown as LngLatBoundsLike, { padding: 16, animate: false });
  }, []);

  /** Ruling 9. Re-asks the bucket and, only if it moved, re-walks the geometry through setData. */
  const pushFactor = useCallback(() => {
    const day = instances.current[0]?.map;
    if (!day) return;
    const next = exagFactor(day.getZoom(), latest.current.state.layers.exag);
    if (next === factor.current) return;
    factor.current = next;
    const d = latest.current.data;
    if (d) {
      const payload = spotSource(d.spots, next);
      for (const { map: m } of instances.current) {
        const src = m.getSource(SPOT_SOURCE) as GeoJSONSource | undefined;
        if (src) src.setData(payload as never);
      }
    }
    onFactorChange?.(next);
  }, [onFactorChange]);

  /* ── boot: two instances, synced ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!dayHost.current || !nightHost.current || instances.current.length) return;
    if (!hasWebGl()) return;
    ensurePmtilesProtocol();
    const { theme: th, baseKey: bk } = latest.current;

    const build = (container: HTMLDivElement, period: Period): Instance => {
      const m = new MaplibreMap({
        container,
        style: buildBasemapStyle(th, bk) as never,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        /* Prototype line 610: `zoomControl: false, attributionControl: true`. MapLibre's zoom
         * control is opt-in, so only attribution is asked for - the original's own
         * `#zin`/`#zout` buttons ARE the control, and a second one in the corner would be a
         * visible addition. The NIGHT instance declines attribution outright: it sits on top of
         * the day one, so two identical credits would stack in the same corner. */
        attributionControl: period === 'day' ? { compact: false, customAttribution: BASEMAP_ATTRIBUTION } : false,
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
      m.touchZoomRotate.disableRotation();
      return { map: m, period };
    };

    const day = build(dayHost.current, 'day');
    const night = build(nightHost.current, 'night');
    instances.current = [day, night];
    setDayMap(day.map);

    /* DEV-ONLY HANDLE. `import.meta.env.DEV` is statically false in a production build, so Rollup
     * removes this branch entirely - the shipped bundle has no global. It exists because the map
     * is the one part of this app that cannot be inspected from the DOM: verifying what the
     * basemap's `boundaries` source-layer actually contains, which spots a filter selects, or
     * what the second instance costs, means asking MapLibre, and there is no other way in. */
    if (import.meta.env.DEV) {
      (globalThis as unknown as Record<string, unknown>).__suhiMap = day.map;
      (globalThis as unknown as Record<string, unknown>).__suhiMaps = { day: day.map, night: night.map };
    }

    /* ONE SUBSCRIPTION, `move`, AND THE GUARD IS WHAT MAKES IT ONE. Ruling 35 names
     * `move`/`zoom`/`rotate`; MapLibre fires `move` during all three (and during pitch), so
     * `move` alone is the complete set and the other two would only re-enter this handler.
     * `jumpTo` on the target fires its own `move`, which is why `syncing` exists - without it
     * the two instances bounce a camera update back and forth until the stack gives out. */
    let syncing = false;
    const syncFrom = (from: MaplibreMap, to: MaplibreMap) => () => {
      if (syncing) return;
      syncing = true;
      /* `jumpTo`, never `easeTo`: the follower must be on the leader's camera THIS frame or the
       * swipe line would cut across two different views. */
      to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
      syncing = false;
    };
    const dayToNight = syncFrom(day.map, night.map);
    const nightToDay = syncFrom(night.map, day.map);
    day.map.on('move', dayToNight);
    night.map.on('move', nightToDay);

    /* ── hover and click, which were per-FEATURE handlers in Leaflet ──────────────────────
     *
     * `onEachFeature` attached three listeners to each of 441 paths (lines 680-685). MapLibre
     * has no feature nodes, so the map is asked what is under the pointer instead
     * (`queryRenderedFeatures`), which is one hit test per move rather than 441 live listeners.
     *
     * THE EVENT GOES TO WHICHEVER INSTANCE IS VISIBLE AT THAT POINT, FOR FREE. `clip-path`
     * clips hit-testing as well as painting, so the night canvas receives pointer events only
     * inside its own band and everything to the left of the swipe falls through to the day
     * canvas underneath. That is the whole reason the night instance keeps its pointer events
     * rather than being `pointer-events:none`.
     *
     * `.spotpath{cursor:pointer}` (line 168) was a class on the SVG path; there is no path, so
     * the canvas cursor carries it. */
    for (const inst of instances.current) {
      const m = inst.map;
      const hit = (e: MapMouseEvent): SpotProperties | null => {
        const layers = periodLayers(inst.period).filter((id) => m.getLayer(id));
        if (layers.length === 0) return null;
        const found = m.queryRenderedFeatures(e.point, { layers: layers as string[] });
        return found.length ? (found[0].properties as unknown as SpotProperties) : null;
      };
      m.on('mousemove', (e) => {
        const spot = hit(e);
        m.getCanvas().style.cursor = spot ? 'pointer' : '';
        if (spot) showTip({ kind: 'spot', spot }, e.originalEvent.clientX, e.originalEvent.clientY);
        else hideTip();
      });
      m.on('mouseout', hideTip);
      /* Prototype lines 684 and 632 together: a spot click opens the drawer and stops
       * propagating, and the map's own click handler is `closeDrawer`. One handler with a
       * branch is the same behaviour without the propagation dance. */
      m.on('click', (e) => {
        const spot = hit(e);
        if (spot) openSpot(spot);
        else closeDrawer();
      });

      /* NOT `m.on('load')`, AND THE DIFFERENCE IS LOAD-BEARING. MapLibre's `load` fires only
       * once the style AND every source's metadata have resolved, so a basemap archive that
       * 404s, or is served without range-request support, means `load` never fires - and the
       * contour polygons and the zoom hint would both be waiting behind a basemap they do not
       * need. The fidelity guard found this as a race before it could be found as an outage:
       * Nocturne passed and Modernist failed on `.ovl width: 564.25 vs 355.81`, which is the
       * zoom hint still reading "true extent" because the factor had not been pushed yet.
       *
       * So: the camera and the factor are set SYNCHRONOUSLY, and the overlays go in on
       * `styledata` - which fires when the style JSON is parsed, before any tile request. Our
       * data is then independent of the basemap's availability, which is also the honest
       * dependency direction: the contours are the deliverable and the basemap is context. */
      m.on('styledata', () => {
        styleReady.current = true;
        addOverlays(m);
        /* AFTER the style is (re)parsed and BEFORE visibility: a setStyle hands back the empty
         * collection the style declares, so without this the state lines disappear on the first
         * theme flip - which would look like a rendering artefact rather than a dropped source. */
        applyBoundaries(m);
        applyVisibility();
      });
    }

    // `zoomend` in the original (line 627) re-rendered everything; here only a bucket change
    // does, and the bucket is read off the day instance - the night one is on the same camera.
    pushFactor();
    day.map.on('zoom', pushFactor);

    /* Replaces TWO pieces of the original: the 140 ms polling interval that waited for
     * `#mapwrap` to have a size (lines 638-646) and the 240 ms timeout after `#frameToggle`
     * (line 1009). A ResizeObserver is the same answer to both, fires once per actual change
     * instead of 250 times, and leaves no timer running in a hidden document. One observer for
     * both containers: they are the same box. */
    const ro = new ResizeObserver(() => {
      for (const { map: m } of instances.current) m.resize();
    });
    ro.observe(dayHost.current);

    return () => {
      ro.disconnect();
      for (const { map: m } of instances.current) m.remove();
      instances.current = [];
      setDayMap(null);
    };
  }, [addOverlays, applyBoundaries, applyVisibility, pushFactor, showTip, hideTip, openSpot, closeDrawer]);

  /* ── task 12: the ADM1 boundaries, fetched once and kept ───────────────────────────────── */
  useEffect(() => {
    /* No WebGL means no map to put them in, and it is also what keeps the twelve jsdom suites
     * that render <App/> out of a fetch for a file jsdom could not serve them anyway. */
    if (!hasWebGl()) return;
    let live = true;
    loadStateBoundaries().then(
      (fc) => {
        if (!live) return;
        states.current = fc;
        applyBoundaries();
      },
      (err: Error) => {
        /* A WARNING, NOT A THROW, and the layer stays empty. The contours are the deliverable
         * and the boundaries are context - the same dependency direction the boot effect's
         * `styledata` note argues for the basemap. An absent state layer is a visible absence;
         * what this must never do is fall back to the basemap's own admin lines, which is where
         * the neighbours' divisions came from. */
        console.warn(`state boundaries unavailable, the layer stays empty: ${err.message}`);
      },
    );
    /* StrictMode mounts effects twice; the flag makes the discarded first fetch a no-op rather
     * than a second setData race. The fetch itself is a cached GET. */
    return () => {
      live = false;
    };
  }, [applyBoundaries]);

  /* ── the imperative surface App's zoom buttons use ─────────────────────────────────────── */
  useEffect(() => {
    const ref = mapApi;
    ref.current = {
      zoomIn: () => instances.current[0]?.map.zoomIn(),
      zoomOut: () => instances.current[0]?.map.zoomOut(),
      fitNation: () => {
        const m = instances.current[0]?.map;
        if (m) fit(m);
      },
      focusCity: (city: string) => {
        const m = instances.current[0]?.map;
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
  }, [mapApi, fit]);

  /* ── theme / basemap: rebuild the style, then put the overlays back ────────────────────── */
  const booted = useRef(false);
  useEffect(() => {
    if (!instances.current.length) return;
    /* Skip the first run: boot already built the style with this theme, and a setStyle here
     * would throw away the layers `styledata` is about to add. StrictMode's double mount makes
     * that a real case, not a theoretical one. */
    if (!booted.current) {
      booted.current = true;
      return;
    }
    styleReady.current = false;
    /* BOTH instances, which is the whole of ruling 35's contribution to Review Focus 4: a
     * repaint that reached only the day map would leave the night side of the swipe on the
     * previous palette, and it would look like a rendering artefact rather than a bug. */
    for (const { map: m } of instances.current) {
      m.setStyle(buildBasemapStyle(theme, baseKey) as never, { diff: false });
      /* The boot effect's `styledata` listener re-adds the overlays (it was registered first,
       * so it runs first); this one re-applies the passes that depend on state the new style
       * does not carry. */
      m.once('styledata', () => {
        applyPaint();
        applyFilters();
        applyVisibility();
      });
    }
    /* `paintEpoch` IS the subscription, and it is in this list on purpose even though `theme`
     * changes with it: the counter is what says "CSS-resolved paint is stale", and a future
     * repaint trigger that is not a theme change (a token edit in dev, say) would bump only the
     * counter. Removing it would silently drop the mechanism. */
  }, [theme, paintEpoch, baseKey, addOverlays, applyPaint, applyFilters, applyVisibility]);

  useEffect(applyPaint, [applyPaint, theme, paintEpoch, state.year, state.contour, state.opacity, data]);
  useEffect(applyFilters, [applyFilters, state.contour, state.cluster, state.city, data]);
  useEffect(applyVisibility, [applyVisibility, state.layers, data]);

  /* ── ruling 35: the night instance's clip ──────────────────────────────────────────────── */
  useEffect(() => {
    const el = nightHost.current;
    if (el) el.style.clipPath = swipeGeometry(swipePct).nightClip;
  }, [swipePct]);

  /* ── ruling 9: the exaggeration toggle, and the data arriving after `load` ─────────────── */
  useEffect(() => {
    if (!instances.current.length || !data) return;
    const day = instances.current[0].map;
    if (!day.getSource(SPOT_SOURCE)) {
      /* The data landed after the style. `styleReady` rather than `isStyleLoaded()` or an
       * `idle` wait, both of which depend on every SOURCE having loaded - so an unavailable
       * basemap would mean the contours never get added at all. */
      if (styleReady.current) {
        addOverlays();
        applyVisibility();
      } else {
        day.once('styledata', () => {
          addOverlays();
          applyVisibility();
        });
      }
      return;
    }
    /* `state.layers.exag` changes the factor without the zoom moving, so the bucket comparison
     * has to be re-asked here rather than waited for on a zoom event. */
    const next = exagFactor(day.getZoom(), state.layers.exag);
    if (next !== factor.current) {
      factor.current = next;
      onFactorChange?.(next);
    }
    const payload = spotSource(data.spots, factor.current);
    for (const { map: m } of instances.current) {
      const src = m.getSource(SPOT_SOURCE) as GeoJSONSource | undefined;
      if (src) src.setData(payload as never);
    }
  }, [data, state.layers.exag, addOverlays, applyVisibility, onFactorChange]);

  /* `#map` keeps its id and its `position:absolute; inset:0` from app.css. MapLibre adds
   * `.maplibregl-map` to it; app.css carries the matching container rules next to the
   * `.leaflet-container` ones it transcribed. `#mapNight` is the ruling 35 instance and is NOT
   * a compared selector - the original has no counterpart, because Leaflet put both periods in
   * one container. It is `aria-hidden` because it duplicates nothing a reader can read: the map
   * carries no text of its own (Task 6 ships no symbol layers) and the two canvases together
   * are one picture. */
  return (
    <>
      <div id="map" ref={dayHost} />
      <div id="mapNight" ref={nightHost} aria-hidden="true" />
      <CityCircles map={dayMap} cities={data?.cities ?? []} />
    </>
  );
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
