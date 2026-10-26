/* The city proportional-symbol rings and their labels. `renderCities`, prototype lines 752-777.
 *
 * RULING 13 - THESE ARE DOM OVERLAYS, POSITIONED WITH `map.project()`, NOT MAPLIBRE LAYERS.
 * A MapLibre `circle` layer has no dash property (`line-dasharray` exists on line layers only),
 * and its `symbol` layer offers `text-halo-*` rather than `.citylabel`'s doubled
 * `text-shadow: 0 0 3px var(--color-bg), 0 0 3px var(--color-bg)`. Task 6 therefore shipped no
 * symbol layers at all; labels live here.
 *
 * ONE CORRECTION TO RULING 13'S MECHANISM, AND IT IS THE REASON THE RINGS ARE SVG RATHER THAN
 * DIVS. The ruling says a ring is "`border: 1px dashed` on a `border-radius: 50%` element, so
 * the CSS transfers verbatim". It does not transfer verbatim, in two ways that both matter:
 *
 *   1. CSS `border-style: dashed` has NO dash length. The lengths are the browser's, derived
 *      from the border width, and no property can set them - so the original's
 *      `dashArray: '4 3'` is unexpressible as a CSS border. `stroke-dasharray="4 3"` is the
 *      same two numbers the original wrote.
 *   2. The original's markers are `fill: false`, i.e. SVG `fill="none"`, so they are hit ONLY
 *      ON THE STROKE. A div is hit across its whole box, so hovering the middle of Lagos's
 *      22px ring would show the CITY tooltip where the original shows the SPOT's - the rings
 *      would swallow hovers and drags over the very polygons they annotate.
 *
 * Leaflet draws circleMarkers as SVG, so SVG is the verbatim transfer here and HTML is the
 * substitute. The labels ARE divs (`L.divIcon` is a div, line 774) and keep `.citylabel`
 * untouched, text-shadow included.
 *
 * RULING 14 / §9.1 BUG 10 - THE RINGS NOW SIT ABOVE THE SPOTS. Leaflet had `cityPane` at 410,
 * under `dayPane`/`nightPane` at 420/421, while the handoff docs specify 460; the code's own
 * comment calls the rings an annotation on the polygons, which an annotation rendered
 * underneath cannot be. The two overlays therefore carry z-index 460 and 470 - the docs' number
 * and the original's `labelPane` - and both sit above the two map canvases. This is a sanctioned
 * VISIBLE change and `ALLOWED_DIFFS` carries its entry against `.citycircle`.
 *
 * POSITIONING IS IMPERATIVE, ON PURPOSE. The React tree is rebuilt only when the DATA changes -
 * the city list, the metric, the scope, the two layer toggles. A pan or a zoom fires many times
 * a second and only ever moves existing nodes, so it writes `cx`/`cy` (and `left`/`top` for the
 * labels) straight onto the nodes from the offsets stored on them, with no reconciliation. That
 * is what Leaflet did too: a pane transform, not a re-render.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { City } from '../app/data';
import { useAppState, type CircleMetric, type PopMode } from '../app/state';
import { CIRCLE_FIELD, popScale } from '../rail/PopCircles';
import { useInteractions } from './interactions';

/** Prototype line 764: `radius: Math.max(2.5, ring.r)`. Applied to the DRAWN radius only - the
 * sort and the label offset both read the unclamped value, as the original's do. */
export const RING_MIN_RADIUS = 2.5;
/** Prototype line 771: `Math.max(...radii, 3) + 4`, and line 774's `iconAnchor: [-off, 7]`. */
export const LABEL_FLOOR = 3;
export const LABEL_GAP = 4;
export const LABEL_BASELINE = 7;

/** The fill tokens stay fill tokens (ruling 32): this is a 1px stroke at opacity .5, not text,
 * and §5.7 picked exactly this pair as the only ramp members clearing 3:1 in both themes. */
export const COLD_RING_TOKEN = '--cold-3';
export const HOT_RING_TOKEN = '--hot-4';

export interface Ring {
  /** The scale's output, UNCLAMPED - what the sort and the label offset use. */
  readonly r: number;
  /** What is drawn: `max(2.5, r)`. */
  readonly radius: number;
  readonly token: string;
  readonly kind: 'hot' | 'cold';
}

/**
 * Prototype lines 756-763. Cold first, then hot, then sorted LARGEST FIRST so the smaller ring
 * paints over the larger one and both stay readable where they nearly coincide.
 *
 * `popMode` chooses which rings exist: `both` gives two, `hot` and `cold` one each. Note the
 * conditions are `!== 'hot'` and `!== 'cold'`, not equality tests - so an unknown mode would
 * draw both rather than none.
 */
export function cityRings(city: City, rad: (v: number) => number, popMode: PopMode, metric: CircleMetric): Ring[] {
  const [fh, fc] = CIRCLE_FIELD[metric];
  const rings: Ring[] = [];
  if (popMode !== 'hot') {
    const r = rad(city[fc] as number);
    rings.push({ r, radius: Math.max(RING_MIN_RADIUS, r), token: COLD_RING_TOKEN, kind: 'cold' });
  }
  if (popMode !== 'cold') {
    const r = rad(city[fh] as number);
    rings.push({ r, radius: Math.max(RING_MIN_RADIUS, r), token: HOT_RING_TOKEN, kind: 'hot' });
  }
  rings.sort((a, b) => b.r - a.r);
  return rings;
}

/** Prototype line 771: the label clears the biggest ring, with 3px as the floor when every
 * ring is tiny. Reads the UNCLAMPED radii, so a city whose rings both fall under 2.5 gets the
 * floor rather than the drawn 2.5 - the original's arithmetic, kept. */
export function labelOffset(rings: readonly Ring[]): number {
  return Math.max(...rings.map((ring) => ring.r), LABEL_FLOOR) + LABEL_GAP;
}

export interface CityCirclesProps {
  readonly map: MaplibreMap | null;
  readonly cities: readonly City[];
}

export function CityCircles({ map, cities }: CityCirclesProps) {
  const [state] = useAppState();
  const { showTip, hideTip, focusCity } = useInteractions();
  const svg = useRef<SVGSVGElement | null>(null);
  const labels = useRef<HTMLDivElement | null>(null);

  /* Prototype line 755: the city scope narrows the overlay to one city, exactly as it narrows
   * the spot filter. */
  const shown = useMemo(
    () => (state.city ? cities.filter((c) => c.city === state.city) : cities),
    [cities, state.city],
  );

  const rings = useMemo(() => {
    const rad = popScale(cities, state.circleMetric);
    return shown.map((city) => ({ city, rings: cityRings(city, rad, state.popMode, state.circleMetric) }));
    /* The SCALE's domain is taken from every city (`cities`), not from the scoped subset: a
     * circle must mean the same number of people whether or not the map is zoomed to one city.
     * Prototype line 749 computes it from `CITIES`, outside the scope filter, for that reason. */
  }, [cities, shown, state.popMode, state.circleMetric]);

  /** Writes positions onto whatever is currently rendered. One pass for both overlays. */
  const position = useCallback(() => {
    const m = map;
    if (!m) return;
    const circles = svg.current?.querySelectorAll<SVGCircleElement>('circle[data-lon]');
    if (circles) {
      for (const el of circles) {
        const p = m.project([Number(el.dataset.lon), Number(el.dataset.lat)]);
        el.setAttribute('cx', String(p.x));
        el.setAttribute('cy', String(p.y));
      }
    }
    const texts = labels.current?.querySelectorAll<HTMLDivElement>('div[data-lon]');
    if (texts) {
      for (const el of texts) {
        /* THE OFFSET IS A MARGIN, NOT PART OF left/top, AND THAT IS MEASURED RATHER THAN
         * stylistic. Leaflet implements `iconAnchor` as NEGATIVE MARGINS on the icon element -
         * `iconAnchor: [-off, 7]` becomes `margin-left: ${off}px; margin-top: -7px` - and
         * places the element itself at the projected point. `.citylabel` is a selector the
         * fidelity guard measures, `margin` is one of its BOX_PROPS, and folding the offset
         * into `left`/`top` reported `margin: 0px vs -7px 0px 0px 20.4576px` on the first
         * guard run. The margins are set once in the render; only the point moves here. */
        const p = m.project([Number(el.dataset.lon), Number(el.dataset.lat)]);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
    }
  }, [map]);

  /* Position after every render that could have added or moved a node, and on every camera
   * event. `move` covers pan, flyTo and fitBounds; `zoom` covers the wheel and the buttons;
   * `resize` matters because `project` is relative to the container. */
  useEffect(() => {
    position();
    const m = map;
    if (!m) return;
    m.on('move', position);
    m.on('zoom', position);
    m.on('resize', position);
    return () => {
      m.off('move', position);
      m.off('zoom', position);
      m.off('resize', position);
    };
  }, [map, position, rings, state.layers.cities, state.layers.labels]);

  /* Prototype line 754: `if (!state.layers.cities) return;` returns before the labels are added
   * too, so `layers.labels` is only reachable while `layers.cities` is on. That reads like a
   * bug and is not: the label's offset is derived from the ring radii, so a label without its
   * rings would be positioned by geometry that is not on screen. */
  if (!state.layers.cities) return null;

  return (
    <>
      {/* `pointer-events:none` on the root so the map keeps the pan gesture everywhere the
        * rings are not; each circle takes the SVG default (`visiblePainted`), which with
        * `fill="none"` means the STROKE and nothing else - the original's `fill: false`. */}
      <svg id="cityLayer" ref={svg} style={{ position: 'absolute', inset: 0, zIndex: 460, pointerEvents: 'none' }}>
        {rings.map(({ city, rings: rs }) =>
          rs.map((ring) => (
            <circle
              key={`${city.city}-${ring.kind}`}
              className="citycircle"
              data-city={city.city}
              data-lon={city.lon}
              data-lat={city.lat}
              r={ring.radius}
              fill="none"
              strokeWidth={1}
              strokeDasharray="4 3"
              /* `var()` rather than a resolved hex, so a theme flip re-colours the rings with
               * no re-render at all - which the original's baked `cssv()` literal did not:
               * `applyTheme` had to call `renderCities()` (line 563) to get them back. */
              style={{ stroke: `var(${ring.token})`, opacity: 0.5, cursor: 'pointer', pointerEvents: 'visiblePainted' }}
              onMouseMove={(e) => showTip({ kind: 'city', city: city.city }, e.clientX, e.clientY)}
              onMouseOut={hideTip}
              onClick={(e) => {
                /* `L.DomEvent.stopPropagation` (line 767). Without it the click also reaches
                 * the map, whose own handler is `closeDrawer` (line 632) - so the drawer
                 * `focusCity` opens would be closed again by the same click. */
                e.stopPropagation();
                focusCity(city.city);
              }}
            />
          )),
        )}
      </svg>
      {state.layers.labels ? (
        <div
          id="labelLayer"
          ref={labels}
          /* `labelPane` at 470 with `pointerEvents:'none'` (prototype lines 618-619), and the
           * markers themselves `interactive: false` (line 773). */
          style={{ position: 'absolute', inset: 0, zIndex: 470, pointerEvents: 'none' }}
        >
          {rings.map(({ city, rings: rs }) => (
            <div
              key={city.city}
              className="citylabel"
              data-lon={city.lon}
              data-lat={city.lat}
              style={{
                position: 'absolute',
                /* Leaflet's `iconAnchor: [-off, 7]` (prototype line 774), which it applies as
                 * negative margins - see `position()` above. */
                marginLeft: `${labelOffset(rs)}px`,
                marginTop: `${-LABEL_BASELINE}px`,
              }}
            >
              {city.city}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
