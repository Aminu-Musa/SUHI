// @vitest-environment jsdom
/* `.drawer` - the spot and city panel. Renders inside <StrictMode>, as src/main.tsx does
 * (standing rule from Task 2): the drawer owns its own focus effect, and an effect that is not
 * idempotent under a double mount is a production bug, not a test artefact.
 *
 * The map is NOT involved. `hasWebGl()` is false in jsdom so MapLibre declines to boot, and the
 * drawer is driven through the interactions context exactly as a spot click drives it.
 */

import { StrictMode, useEffect } from 'react';
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { max } from 'd3';
import rawCss from '../styles/app.css?raw';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider } from '../app/state';
import { FIXTURE } from '../rail/fixtures';
import { Drawer, popBarDenominator, popBarPercent } from './Drawer';
import { InteractionsProvider, useInteractions, type DrawerTarget } from './interactions';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

/** Opens the drawer on a target the moment it mounts, which is what a spot click does. */
function Opener({ target }: { readonly target: DrawerTarget | null }) {
  const { openSpot, openCity, closeDrawer } = useInteractions();
  useEffect(() => {
    if (!target) closeDrawer();
    else if (target.kind === 'spot') openSpot(target.spot);
    else openCity(target.city);
  }, [target, openSpot, openCity, closeDrawer]);
  return null;
}

const SPOT = FIXTURE.spots.features.find((f) => f.properties.contour_level === 'L50')!.properties;
const CITY = FIXTURE.cities[0].city;

function show(target: DrawerTarget | null) {
  return render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              {/* A focusable element OUTSIDE the drawer, so the focus restore has somewhere
                * real to go back to - which is what a `.citycircle` or a table row is. */}
              <button id="opener">open</button>
              <Opener target={target} />
              <Drawer data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

const drawer = () => document.getElementById('drawer') as HTMLElement;

test('the drawer element exists CLOSED, because `.drawer` is a selector the fidelity guard measures', () => {
  /* `forceMount` on the Radix content. The original's aside is always in the DOM, empty, at
   * translateX(100%); letting Radix unmount it would delete a compared selector and throw away
   * the CSS slide, which has nothing to transition from if the node appears and disappears. */
  show(null);
  expect(drawer()).toBeTruthy();
  expect(drawer().dataset.open).toBe('false');
  expect(drawer().textContent).toBe('');
  expect(drawer().getAttribute('aria-hidden')).toBe('true');
});

test('opens with the spot record and closes on Escape', () => {
  show({ kind: 'spot', spot: SPOT });
  expect(drawer().dataset.open).toBe('true');
  // The record, not a summary of it: the id, the city and the figures all come from `SPOT`.
  expect(drawer().textContent).toContain(SPOT.spot_id);
  expect(drawer().textContent).toContain(SPOT.city);
  expect(drawer().querySelector('.pill')).toBeTruthy();
  expect(drawer().querySelectorAll('dl.dl2')).toHaveLength(3);

  act(() => {
    fireEvent.keyDown(document, { key: 'Escape' });
  });
  expect(drawer().dataset.open).toBe('false');
  expect(drawer().textContent).toBe('');
});

test('it is NON-modal: the rest of the page is not aria-hidden and stays clickable', () => {
  /* `modal={false}`. The original's drawer leaves the map panning, the rail working and the
   * tooltip appearing underneath it; `map.on("click", closeDrawer)` is the only outside click
   * that dismisses it (prototype line 632). A modal dialog would aria-hide the document and
   * block pointer events on the map, which is a behaviour change dressed as a pattern. */
  show({ kind: 'spot', spot: SPOT });
  const opener = document.getElementById('opener') as HTMLElement;
  expect(opener.closest('[aria-hidden="true"]')).toBeNull();
  expect(drawer().getAttribute('role')).toBe('dialog');
});

test('traps focus while open and restores it on close', () => {
  const view = show(null);
  const opener = document.getElementById('opener') as HTMLButtonElement;
  act(() => opener.focus());
  expect(document.activeElement).toBe(opener);

  view.rerender(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <button id="opener">open</button>
              <Opener target={{ kind: 'spot', spot: SPOT }} />
              <Drawer data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
  /* Radix's non-modal content sets `trapFocus: false` and `forceMount` stops its mount/unmount
   * focus hooks firing at all, so the initial focus, the trap and the restore are the drawer's
   * own - see Drawer.tsx's header. This test is what holds them. */
  expect(document.activeElement).toBe(drawer().querySelector('.x'));

  const stops = [...drawer().querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')];
  expect(stops.length).toBeGreaterThan(2);
  const last = stops[stops.length - 1];
  act(() => last.focus());
  fireEvent.keyDown(drawer(), { key: 'Tab' });
  expect(document.activeElement).toBe(stops[0]);
  fireEvent.keyDown(drawer(), { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);

  act(() => {
    fireEvent.keyDown(document, { key: 'Escape' });
  });
  expect(document.activeElement).toBe(opener);
});

test('the close button closes it', () => {
  show({ kind: 'spot', spot: SPOT });
  const x = drawer().querySelector('.x') as HTMLButtonElement;
  act(() => {
    fireEvent.click(x);
  });
  expect(drawer().dataset.open).toBe('false');
});

test('numeric rows use the ink tokens, never the fill tokens (ruling 32)', () => {
  show({ kind: 'spot', spot: SPOT });
  /* `.pill` is the worst case on the page: 9.5px text whose `border: solid currentColor` takes
   * the same colour, on `--color-bg`, where Nocturne's `--cold-5` measures 1.75:1. The ink
   * scale's output is a resolved hex (d3 interpolates two concrete colours), so the assertion
   * is that it is one of the ELEVEN ink values and not one of the eleven fill values. */
  const pill = drawer().querySelector('.pill') as HTMLElement;
  const fills = new Set(['#f6e08a', '#f2c14e', '#ec9a3c', '#e06b2f', '#c9382c']);
  const colds = new Set(['#cfe4f7', '#8fbfe8', '#5793d1', '#3467ad', '#20407c']);
  const colour = pill.style.color;
  expect(colour).not.toBe('');
  for (const bad of [...fills, ...colds]) expect(colour).not.toContain(bad);

  /* The `bh_significant` row and the city panel's accent lines are STATIC tokens, so they go in
   * as `var(--…-ink)` and re-resolve on a theme flip with no re-render. Asserting the string
   * is asserting exactly that mechanism. */
  const sig = [...drawer().querySelectorAll<HTMLElement>('dd')].find((el) => el.style.color !== '');
  expect(sig).toBeDefined();
  expect(['var(--hot-4-ink)', 'var(--ui-muted)']).toContain(sig!.style.color);
});

test('the spot list swatch stays on the FILL ramp, because a swatch is a fill (ruling 32)', () => {
  /* The other half of ruling 32, and the one that makes it a rule rather than a sweep: the 8px
   * block of colour beside each spot id carries no text, so it keeps the fill token. If this
   * ever turns into an ink value, the rule has been applied mechanically instead of read. */
  show({ kind: 'city', city: CITY });
  const swatch = drawer().querySelector('.rowlist .rw span span') as HTMLElement;
  expect(swatch).toBeTruthy();
  expect(swatch.style.background).not.toBe('');
  expect(swatch.style.width).toBe('8px');
});

test('spec §9.1 bug 4 - the population bar is proportional, not divided by the magic 230', () => {
  /* The original wrote `width: Math.min(100, c.pop_hot / 230)%`. Two things were wrong with it:
   * the 230 is proportional to nothing (it happens to make ~23 000 people fill the track), and
   * every city under 230 people drew a sub-1% sliver. The denominator is now the national
   * maximum for the measure, which is spec §7.5's own convention for a bar with no natural
   * track. */
  const denominator = popBarDenominator(FIXTURE.cities);
  expect(denominator).toBe(max(FIXTURE.cities, (c) => c.pop_hot));

  // The biggest city fills the track exactly, and the CLAMP is not what puts it there.
  const biggest = FIXTURE.cities.reduce((a, b) => (a.pop_hot > b.pop_hot ? a : b));
  expect(popBarPercent(biggest.pop_hot, denominator)).toBe(100);
  expect((biggest.pop_hot / denominator) * 100).toBe(100);

  // And the magic number is gone: every city's width differs from what 230 produced.
  const differs = FIXTURE.cities.filter(
    (c) => Math.abs(popBarPercent(c.pop_hot, denominator) - Math.min(100, c.pop_hot / 230)) > 0.001,
  );
  expect(differs.length).toBeGreaterThan(FIXTURE.cities.length / 2);

  // The rendered bar agrees with the function.
  show({ kind: 'city', city: biggest.city });
  const bar = drawer().querySelector('.kpi.wide .bar i') as HTMLElement;
  expect(bar.style.width).toBe('100%');
});

test('spec §9.1 bug 4 - a small city gets a readable share rather than a sub-1% sliver', () => {
  const denominator = popBarDenominator(FIXTURE.cities);
  /* The SMALLEST NON-ZERO city. Several cities have no population in their hot spots at all,
   * and 0/230 and 0/max are both 0 - a comparison between them proves nothing. */
  const small = FIXTURE.cities.filter((c) => c.pop_hot > 0).reduce((a, b) => (a.pop_hot < b.pop_hot ? a : b));
  // Under the magic 230 this city's bar was pop_hot/230 percent. Whatever that was, the honest
  // share is its position against the biggest city, and the two are not the same number.
  expect(popBarPercent(small.pop_hot, denominator)).not.toBeCloseTo(Math.min(100, small.pop_hot / 230), 6);
  expect(popBarPercent(small.pop_hot, denominator)).toBeGreaterThanOrEqual(0);
  expect(popBarPercent(small.pop_hot, denominator)).toBeLessThanOrEqual(100);
});

test('popBarDenominator falls back to 1 rather than producing a NaN width', () => {
  // `max([])` is undefined and `pop_hot / undefined * 100` is `NaN%`, which the browser drops
  // silently - the same reason `popScale` carries a `|| 1` (prototype line 750). Reachable
  // before the fetch lands.
  expect(popBarDenominator([])).toBe(1);
  expect(Number.isFinite(popBarPercent(0, popBarDenominator([])))).toBe(true);
});

test('spec §9.1 bug 8 - the opened spot is announced via aria-live', () => {
  const view = show(null);
  const live = document.getElementById('drawerLive') as HTMLElement;
  /* The region is a SIBLING of `.drawer`, not a child: a child would be removed with the
   * content on close, and a live region that is not already in the accessibility tree
   * announces nothing when it appears. */
  expect(live).toBeTruthy();
  expect(live.getAttribute('aria-live')).toBe('polite');
  expect(drawer().contains(live)).toBe(false);
  expect(live.textContent).toBe('');

  view.rerender(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <button id="opener">open</button>
              <Opener target={{ kind: 'spot', spot: SPOT }} />
              <Drawer data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
  const announced = (document.getElementById('drawerLive') as HTMLElement).textContent ?? '';
  expect(announced).toContain(SPOT.spot_id);
  expect(announced).toContain(SPOT.city);
});

test('spec §9.1 bug 8 - app.css disables the drawer and swipe transitions under prefers-reduced-motion', () => {
  /* jsdom does not evaluate media queries, so the rule is asserted in the STYLESHEET rather
   * than in a computed style. That is the honest place for it: the fix is a CSS rule, the
   * browser applies it, and what could regress is the rule going missing.
   *
   * §9.1 is explicit that the separate "zero @media queries" finding is NOT fixed here - a
   * responsive layout is a design decision deferred to §7.8 - so this is the only media query
   * in app.css and the test says so. */
  // Read through Vite's `?raw`, so the assertion is on the shipped text.
  const css = rawCss;
  const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
  expect(block, 'app.css must carry a prefers-reduced-motion block').toBeTruthy();
  const body = block![1];
  expect(body).toMatch(/\.drawer\s*\{\s*transition:\s*none/);
  expect(body).toMatch(/\.swipe[^{]*\{\s*transition:\s*none/);
  // `@media\s*\(` rather than `@media`, so the word in the comment above the rule is not
  // counted as a second query.
  expect((css.match(/@media\s*\(/g) ?? []).length).toBe(1);
});

test('the city panel opens from a name and the spot rows open the spot panel', () => {
  show({ kind: 'city', city: CITY });
  expect(drawer().dataset.open).toBe('true');
  expect(drawer().textContent).toContain(CITY);
  const row = drawer().querySelector('.rowlist .rw') as HTMLElement;
  expect(row).toBeTruthy();
  const sid = row.dataset.sid!;
  act(() => {
    fireEvent.click(row);
  });
  // Still open, now on the spot - and the focus was NOT stolen back to the close button,
  // because the focus effect keys on open/closed rather than on the target.
  expect(drawer().dataset.open).toBe('true');
  expect(drawer().textContent).toContain(sid);
  expect(drawer().querySelector('.rowlist')).toBeNull();
});

test('the spot rows are keyboard-operable (§9.1 bug 3`s finding, same mouse-only pattern)', () => {
  show({ kind: 'city', city: CITY });
  const row = drawer().querySelector('.rowlist .rw') as HTMLElement;
  expect(row.getAttribute('role')).toBe('button');
  expect(row.tabIndex).toBe(0);
  // A DIV, not a <button>: `.rw` declares a font-size and no font-family or background, so a
  // real button would take the UA's font and grey ground - a visible change to a measured row.
  expect(row.tagName).toBe('DIV');
  act(() => {
    fireEvent.keyDown(row, { key: 'Enter' });
  });
  expect(drawer().querySelector('.rowlist')).toBeNull();
});

/* TASK 12 - §9.1 BUG 11's GUARD, WHICH THIS SUITE DID NOT HAVE.
 *
 * Measured in Task 11: mutating `signed` in src/rail/stats.ts to a bare `+` turned five tests red
 * across three suites and did NOT turn this one red, because no test above happens to render a
 * negative value. The fix was guarded in two of its four call sites. The values below come from
 * the shipped data - 46 L50 spots and 18 cities carry a negative SUHII - so this is the bug the
 * original actually prints, not a constructed one.
 */
test('spec §9.1 bug 11 - a negative SUHII never reads `+-` in the SPOT panel', () => {
  const negative = FIXTURE.spots.features.find(
    (f) => f.properties.contour_level === 'L50' && f.properties.suhii < 0,
  )!.properties;
  expect(negative, 'the shipped data has no negative L50 spot to test with').toBeTruthy();
  show({ kind: 'spot', spot: negative });
  const val = drawer().querySelector('.kpi .val') as HTMLElement;
  expect(val.textContent).toBe(String(negative.suhii));
  expect(val.textContent!.startsWith('-')).toBe(true);
  expect(drawer().textContent).not.toContain('+-');
});

test('spec §9.1 bug 11 - a negative SUHII never reads `+-` in the CITY panel, and + survives', () => {
  const negative = FIXTURE.cities.find((c) => c.suhii < 0)!;
  const positive = FIXTURE.cities.find((c) => c.suhii > 0)!;
  expect([negative, positive].every(Boolean)).toBe(true);

  show({ kind: 'city', city: negative.city });
  const dds = () => [...drawer().querySelectorAll('.dl2 dd')].map((d) => d.textContent);
  expect(dds()).toContain(`${negative.suhii} °C`);
  expect(drawer().textContent).not.toContain('+-');
  cleanup();

  /* The sign was FIXED, not deleted. A `signed` that always returned `String(n)` would pass
   * every assertion above, so the positive case is asserted in the same test rather than in a
   * neighbouring one a future edit could delete on its own. */
  show({ kind: 'city', city: positive.city });
  expect(dds()).toContain(`+${positive.suhii} °C`);
});
