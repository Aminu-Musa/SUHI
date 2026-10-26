// @vitest-environment jsdom
/* The city rings and labels (ruling 13). Renders inside <StrictMode>, as src/main.tsx does.
 *
 * MapLibre is not here and is not faked: `map` is null, so `map.project()` never runs and the
 * positions are absent. Everything that is NOT a projection - how many rings, in what order, at
 * what radius, with what dash, and where the label offset comes from - is the arithmetic the
 * original carried in `renderCities`, and that is what these assert.
 */

import { StrictMode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider, type PopMode, type State } from '../app/state';
import { FIXTURE } from '../rail/fixtures';
import { popScale } from '../rail/PopCircles';
import { CityCircles, LABEL_FLOOR, LABEL_GAP, RING_MIN_RADIUS, cityRings, labelOffset } from './CityCircles';
import { InteractionsProvider } from './interactions';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

const CITIES = FIXTURE.cities;
const rad = popScale(CITIES, 'pop');

function show(initial?: Partial<State>) {
  return render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider initial={initial}>
            <InteractionsProvider>
              <CityCircles map={null} cities={CITIES} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

test('two rings per city in both mode, one each in hot and cold (prototype lines 756-761)', () => {
  const city = CITIES[0];
  expect(cityRings(city, rad, 'both', 'pop')).toHaveLength(2);
  expect(cityRings(city, rad, 'hot', 'pop').map((r) => r.kind)).toEqual(['hot']);
  expect(cityRings(city, rad, 'cold', 'pop').map((r) => r.kind)).toEqual(['cold']);
});

test('rings are sorted LARGEST FIRST, so the smaller one paints over the bigger one', () => {
  /* `rings.sort((a,b) => b.r - a.r)` (line 762). The order is not cosmetic: two nearly equal
   * rings drawn the other way round would hide the smaller one entirely. */
  for (const city of CITIES) {
    const rings = cityRings(city, rad, 'both', 'pop');
    expect(rings[0].r).toBeGreaterThanOrEqual(rings[1].r);
  }
  // And it really does reorder - at least one city has a bigger cold ring than hot, so a
  // test that only ever saw hot-first would prove nothing.
  const reordered = CITIES.filter((c) => cityRings(c, rad, 'both', 'pop')[0].kind === 'cold');
  expect(reordered.length).toBeGreaterThan(0);
});

test('the DRAWN radius is max(2.5, r), and that clamp is UNREACHABLE with the shipped scale', () => {
  /* Prototype line 764 clamps the radius passed to Leaflet; lines 762 and 771 both read
   * `ring.r`. That distinction is why `Ring` carries both numbers.
   *
   * MEASURED FINDING: the clamp never fires. `popScale`'s range is `[3, 22]` (line 751), so the
   * smallest radius the scale can return is 3 and `max(2.5, r)` is dead on every one of the 55
   * cities, in both metrics and all three modes. It is transcribed rather than deleted because
   * it is the original's own floor and the range is the thing more likely to be tuned - but a
   * reader should not be left thinking 2.5px rings exist, so this test states it. The second
   * half holds the clamp itself, against the day the range starts below 2.5. */
  for (const metric of ['pop', 'area'] as const) {
    const scale = popScale(CITIES, metric);
    for (const city of CITIES) {
      for (const ring of cityRings(city, scale, 'both', metric)) {
        expect(ring.r).toBeGreaterThanOrEqual(3);
        expect(ring.radius).toBe(ring.r);
      }
    }
  }
  const belowFloor = cityRings(CITIES[0], () => 0.4, 'both', 'pop');
  expect(belowFloor.map((r) => r.radius)).toEqual([RING_MIN_RADIUS, RING_MIN_RADIUS]);
  expect(belowFloor.map((r) => r.r)).toEqual([0.4, 0.4]);
});

test('one shared sqrt domain across hot and cold, so equal areas mean equal population', () => {
  /* The whole point of a proportional-symbol map, and the reason `popScale`'s domain maximum is
   * `Math.max(c[fh], c[fc])` over every city rather than one per class (prototype lines
   * 745-751). A hot ring and a cold ring of the same radius have to mean the same number. */
  const pairs = CITIES.flatMap((c) => cityRings(c, rad, 'both', 'pop').map((r) => ({ r: r.r, kind: r.kind })));
  const hot = pairs.filter((p) => p.kind === 'hot');
  const cold = pairs.filter((p) => p.kind === 'cold');
  expect(hot.length).toBe(cold.length);
  // The same value through the same scale, whichever class asks.
  expect(rad(1000)).toBe(rad(1000));
  expect(rad(0)).toBe(3);
  expect(Math.round(rad(Math.max(...CITIES.map((c) => Math.max(c.pop_hot, c.pop_cold)))))).toBe(22);
});

test('the label clears the biggest ring, with 3px as the floor (prototype line 771)', () => {
  for (const city of CITIES) {
    const rings = cityRings(city, rad, 'both', 'pop');
    const biggest = Math.max(...rings.map((r) => r.r));
    expect(labelOffset(rings)).toBe(Math.max(biggest, LABEL_FLOOR) + LABEL_GAP);
  }
  // The floor is reachable, not decorative.
  expect(labelOffset([{ r: 0.5, radius: 2.5, token: '--hot-4', kind: 'hot' }])).toBe(LABEL_FLOOR + LABEL_GAP);
});

test('an unknown popMode draws BOTH rings rather than none', () => {
  /* The original's conditions are `!== 'hot'` and `!== 'cold'`, not equality tests, so an
   * unexpected value degrades to the full picture. Transcribed, and worth pinning because the
   * obvious rewrite - a switch on three cases - loses it. */
  expect(cityRings(CITIES[0], rad, 'weird' as PopMode, 'pop')).toHaveLength(2);
});

test('the rings are SVG circles with the original`s dash, width and opacity - not CSS borders', () => {
  /* Ruling 13 said "border: 1px dashed on a border-radius:50% element, so the CSS transfers
   * verbatim". It does not: CSS `border-style:dashed` has no dash LENGTH, so `dashArray:'4 3'`
   * is unexpressible, and a div is hit across its whole box where the original's `fill:false`
   * marker is hit only on its stroke. Leaflet draws circleMarkers as SVG, so SVG is the
   * verbatim transfer here and HTML is the substitute. This test is what holds that. */
  show();
  const circles = [...document.querySelectorAll<SVGCircleElement>('#cityLayer circle.citycircle')];
  expect(circles).toHaveLength(CITIES.length * 2);
  const first = circles[0];
  expect(first.getAttribute('stroke-dasharray')).toBe('4 3');
  expect(first.getAttribute('stroke-width')).toBe('1');
  expect(first.getAttribute('fill')).toBe('none');
  expect(first.style.opacity).toBe('0.5');
  // A `var()`, not a baked hex: a theme flip re-colours the rings with no re-render, which the
  // original's `cssv()` literal could not do (it had to call renderCities again, line 563).
  expect(['var(--cold-3)', 'var(--hot-4)']).toContain(first.style.stroke);
});

test('the overlays sit ABOVE the map canvases - §9.1 bug 10, ruling 14', () => {
  /* Leaflet had `cityPane` at 410, UNDER `dayPane`/`nightPane` at 420/421, while the handoff
   * docs specify 460. A sanctioned visible change: the code's own comment calls the rings an
   * annotation on the polygons, which an annotation rendered underneath cannot be. */
  show();
  expect((document.getElementById('cityLayer') as HTMLElement).style.zIndex).toBe('460');
  expect((document.getElementById('labelLayer') as HTMLElement).style.zIndex).toBe('470');
});

test('the label layer is pointer-transparent and the ring layer passes events to its strokes', () => {
  show();
  // `labelPane` was pointerEvents:'none' with `interactive:false` markers (lines 618, 773).
  expect((document.getElementById('labelLayer') as HTMLElement).style.pointerEvents).toBe('none');
  // The SVG ROOT is transparent so the map keeps the pan gesture; each circle takes
  // `visiblePainted`, which with fill="none" means the stroke and nothing else.
  expect((document.getElementById('cityLayer') as unknown as SVGElement).style.pointerEvents).toBe('none');
  const circle = document.querySelector<SVGCircleElement>('circle.citycircle')!;
  // jsdom lower-cases the keyword; the comparison is case-insensitive rather than the value
  // being written wrong.
  expect(circle.style.pointerEvents.toLowerCase()).toBe('visiblepainted');
});

test('labels carry `.citylabel` unchanged, in the cities.json order the guard measures', () => {
  /* `.citylabel` is a compared selector and the guard reads the FIRST match, so the first label
   * in the document has to be the same city on both pages - which it is because both iterate
   * cities.json in file order. Its class must also stay exactly `citylabel`: the doubled
   * text-shadow is the rule's whole content. */
  show();
  const labels = [...document.querySelectorAll<HTMLElement>('#labelLayer .citylabel')];
  expect(labels).toHaveLength(CITIES.length);
  expect(labels[0].className).toBe('citylabel');
  expect(labels.map((l) => l.textContent)).toEqual(CITIES.map((c) => c.city));
});

test('the cities toggle hides the labels TOO, because the original returns before adding them', () => {
  /* Prototype line 754: `if (!state.layers.cities) return;` is above the label branch, so
   * `layers.labels` is only reachable while `layers.cities` is on. That reads like a bug and is
   * not - the label's offset is derived from the ring radii, so a label without its rings would
   * be positioned by geometry that is not on screen. */
  show({ layers: { spots: true, exag: true, cities: false, states: true, nation: true, labels: true } });
  expect(document.getElementById('cityLayer')).toBeNull();
  expect(document.getElementById('labelLayer')).toBeNull();
});

test('the labels toggle hides only the labels', () => {
  show({ layers: { spots: true, exag: true, cities: true, states: true, nation: true, labels: false } });
  expect(document.getElementById('cityLayer')).toBeTruthy();
  expect(document.getElementById('labelLayer')).toBeNull();
});

test('a city scope narrows the overlay but NOT the scale`s domain', () => {
  /* Prototype line 755 filters the drawn cities; line 749 computes the domain from `CITIES`,
   * outside that filter. A circle has to mean the same number of people whether or not the map
   * is zoomed to one city, and recomputing the domain from one city would make the biggest ring
   * 22px every time. */
  const city = CITIES.find((c) => c.pop_hot > 0 && c.pop_hot < Math.max(...CITIES.map((x) => x.pop_hot)))!;
  show({ city: city.city });
  const circles = [...document.querySelectorAll<SVGCircleElement>('circle.citycircle')];
  expect(circles).toHaveLength(2);
  const biggest = Math.max(...circles.map((c) => Number(c.getAttribute('r'))));
  expect(biggest).toBeLessThan(22);
  expect(biggest).toBeCloseTo(Math.max(...cityRings(city, rad, 'both', 'pop').map((r) => r.radius)), 6);
});

test('the area metric swaps the fields without touching the scale`s shape', () => {
  const city = CITIES[0];
  const byArea = popScale(CITIES, 'area');
  const rings = cityRings(city, byArea, 'both', 'area');
  expect(rings).toHaveLength(2);
  expect(rings.map((r) => r.kind).sort()).toEqual(['cold', 'hot']);
  // Different field, so a different radius - the metric segment really does re-encode.
  expect(rings[0].r).not.toBeCloseTo(cityRings(city, rad, 'both', 'pop')[0].r, 6);
});
