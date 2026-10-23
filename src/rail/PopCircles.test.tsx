// @vitest-environment jsdom
/* Population-circle guards - rail group 8.
 *
 * Two things are pinned here that read as detail and are not: that the two segments are
 * genuinely independent state (the original had two separate handlers and nothing resets the
 * other), and that the legend's radii come out of the SAME sqrt scale the map uses, over a
 * domain spanning both the hot and the cold field.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import type { City } from '../app/data';
import { FIXTURE } from './fixtures';
import { CIRCLE_FIELD, LEGEND_VALUES, popScale } from './PopCircles';
import type { State } from '../app/state';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const mount = (initialState: Partial<State> = {}) =>
  renderApp(<App data={FIXTURE} initialState={initialState} />);

const pressed = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(`#${id} button`)].map((b) => b.getAttribute('aria-pressed'));
const buttons = (id: string) => [...document.querySelectorAll<HTMLElement>(`#${id} button`)];
const circles = () => [...document.querySelectorAll<SVGCircleElement>('#popLegend circle')];
const labels = () => [...document.querySelectorAll<SVGTextElement>('#popLegend text')].map((t) => t.textContent);

describe('the two segments', () => {
  test('both segments render with the dictionary labels applyI18n produced, not the markup text', () => {
    /* The static HTML reads "Hot" / "Cold" but carries data-i18n="hotspots"/"coldspots", and
     * applyI18n overwrote the text at boot (prototype line 550) - so the shorter words were
     * never on screen in any language. */
    mount();
    expect(buttons('metricSeg').map((b) => b.textContent)).toEqual(['Population affected', 'Spot area']);
    expect(buttons('popSeg').map((b) => b.textContent)).toEqual(['Both', 'Hot spots', 'Cold spots']);
    expect(pressed('metricSeg')).toEqual(['true', 'false']);
    expect(pressed('popSeg')).toEqual(['true', 'false', 'false']);
  });

  test('metric and scope segments are independent', async () => {
    const user = userEvent.setup();
    mount();

    // Choosing a metric must not move the hot/cold scope.
    await user.click(buttons('metricSeg')[1]);
    expect(pressed('metricSeg')).toEqual(['false', 'true']);
    expect(pressed('popSeg')).toEqual(['true', 'false', 'false']);

    // And choosing a scope must not send the metric back to its default.
    await user.click(buttons('popSeg')[2]);
    expect(pressed('popSeg')).toEqual(['false', 'false', 'true']);
    expect(pressed('metricSeg')).toEqual(['false', 'true']);

    // They are two state fields, not one.
    await user.click(buttons('metricSeg')[0]);
    expect(pressed('metricSeg')).toEqual(['true', 'false']);
    expect(pressed('popSeg')).toEqual(['false', 'false', 'true']);
  });
});

describe('the population scale', () => {
  test('legend radii follow the population scale', () => {
    mount();
    const rad = popScale(FIXTURE.cities, 'pop');
    const vals = LEGEND_VALUES.pop;
    expect(circles().length).toBe(3);
    expect(circles().map((c) => c.getAttribute('r'))).toEqual(vals.map((v) => String(rad(v))));
    expect(labels()).toEqual(['500', '5,000', '23,000']);

    // The scale itself: sqrt over [0, max] onto [3, 22] (prototype lines 747-751).
    expect(rad(0)).toBe(3);
    const domainMax = Math.max(...FIXTURE.cities.map((c) => Math.max(c.pop_hot, c.pop_cold)));
    expect(domainMax).toBe(30653);
    expect(rad(domainMax)).toBeCloseTo(22, 10);
    // sqrt, NOT linear: the eye reads area, so half the radius range is a QUARTER of the value.
    expect(rad(domainMax / 4)).toBeCloseTo(3 + (22 - 3) / 2, 10);
  });

  test('one scale spans BOTH the hot and the cold field, so equal area means equal population', () => {
    /* `Math.max(c[fh], c[fc])` (prototype line 749). The shipped data happens to peak on
     * pop_hot, so the real files cannot tell a both-fields domain from a hot-only one - these
     * two cities can. */
    const cities = [
      { city: 'A', pop_hot: 10, pop_cold: 1000, area_hot: 1, area_cold: 1 },
      { city: 'B', pop_hot: 20, pop_cold: 50, area_hot: 1, area_cold: 1 },
    ] as unknown as City[];
    const rad = popScale(cities, 'pop');
    expect(rad(1000)).toBeCloseTo(22, 10); // the cold maximum sets the domain
    expect(rad(20)).toBeLessThan(rad(1000));
    // The same radius for the same number, whichever class it came from.
    expect(rad(50)).toBe(rad(50));
    expect(CIRCLE_FIELD.pop).toEqual(['pop_hot', 'pop_cold']);
    expect(CIRCLE_FIELD.area).toEqual(['area_hot', 'area_cold']);
  });

  test('an empty city list gives radii, not NaN - the `|| 1` on the domain maximum', () => {
    /* `d3.max([])` is undefined, and a [0, undefined] domain makes every radius NaN, which
     * would write r="NaN" into three circles. Reachable before the fetch lands: the rail is up
     * with `data === null` while the three files are still in flight. */
    const rad = popScale([], 'pop');
    expect(Number.isNaN(rad(500))).toBe(false);
    renderApp(<App data={null} initialState={{}} />);
    for (const c of circles()) expect(c.getAttribute('r')).not.toContain('NaN');
    expect(circles().length).toBe(3);
  });

  test('switching the metric reshapes the legend to km², with the original hard-coded values', () => {
    /* The three legend values are LITERALS (prototype line 780), not quantiles - and 600 km² is
     * larger than anything in the data (the real maximum is 422.36), so that circle is drawn
     * bigger than any on the map. Transcribed, not corrected. */
    mount({ circleMetric: 'area' });
    const rad = popScale(FIXTURE.cities, 'area');
    expect(LEGEND_VALUES.area).toEqual([25, 150, 600]);
    expect(labels()).toEqual(['25 km²', '150 km²', '600 km²']);
    expect(circles().map((c) => c.getAttribute('r'))).toEqual(LEGEND_VALUES.area.map((v) => String(rad(v))));
    expect(rad(600)).toBeGreaterThan(22); // 600 is outside the domain; scaleSqrt does not clamp
  });

  test('the svg sizes itself from the largest circle, on a fixed 240-wide viewBox', () => {
    mount();
    const rad = popScale(FIXTURE.cities, 'pop');
    const biggest = rad(LEGEND_VALUES.pop[2]);
    const svg = document.querySelector('#popLegend svg')!;
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe(String(biggest * 2 + 22));
    expect(svg.getAttribute('viewBox')).toBe(`0 0 240 ${biggest * 2 + 22}`);
    expect(circles().map((c) => c.getAttribute('cx'))).toEqual(['24', '98', '172']);
    expect(circles().every((c) => c.getAttribute('cy') === String(biggest + 2))).toBe(true);
    // Outlines only, so the polygons underneath stay readable (prototype line 764).
    expect(circles().every((c) => c.getAttribute('fill') === 'none')).toBe(true);
  });
});
