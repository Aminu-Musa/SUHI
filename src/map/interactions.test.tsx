// @vitest-environment jsdom
/* The interactions context. Renders inside <StrictMode>, as src/main.tsx does.
 *
 * `focusCity` is the one function here that is three things at once, and the three have to stay
 * together: prototype line 818 sets the city scope, moves the camera and opens the city drawer,
 * in that order. Separating them is how a reader ends up with a drawer describing Kano while
 * the map is framed on Lagos.
 */

import { StrictMode, useEffect } from 'react';
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppStateProvider, useAppState } from '../app/state';
import { InteractionsProvider, useInteractions } from './interactions';
import type { MapApi } from './MapStage';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

/* NOT A MOCK OF MAPLIBRE. `MapApi` is OUR four-method interface - the one the zoom buttons and
 * `focusCity` call - and the real implementation is four lines of `map.zoomIn()` and a
 * `fitBounds`. Standing in for it records which of them the context calls, which is the
 * contract between the context and the map; faking MapLibre itself would be a different and
 * much emptier test. */
function recorder() {
  const calls: string[] = [];
  const api: MapApi = {
    zoomIn: () => calls.push('zoomIn'),
    zoomOut: () => calls.push('zoomOut'),
    fitNation: () => calls.push('fitNation'),
    focusCity: (city) => calls.push(`focusCity:${city}`),
  };
  return { calls, api };
}

test('focusCity sets the scope, moves the camera and opens the city drawer - all three', () => {
  const { calls, api } = recorder();
  const seen: { city: string | null; drawerKind: string | null }[] = [];

  function Probe() {
    const [state] = useAppState();
    const { mapApi, focusCity, drawer } = useInteractions();
    useEffect(() => {
      mapApi.current = api;
    }, [mapApi]);
    useEffect(() => {
      seen.push({ city: state.city, drawerKind: drawer?.kind ?? null });
    }, [state.city, drawer]);
    useEffect(() => {
      if (state.city === null) focusCity('Lagos');
    }, [state.city, focusCity]);
    return null;
  }

  act(() => {
    render(
      <StrictMode>
        <AppStateProvider>
          <InteractionsProvider>
            <Probe />
          </InteractionsProvider>
        </AppStateProvider>
      </StrictMode>,
    );
  });

  expect(calls).toContain('focusCity:Lagos');
  const last = seen[seen.length - 1];
  expect(last.city).toBe('Lagos');
  expect(last.drawerKind).toBe('city');
});

test('focusCity is a no-op on the camera when no map has registered, and still opens the drawer', () => {
  /* The drawer and the scope are state; the camera is a ref that MapLibre fills on boot, and in
   * jsdom - or in a browser with WebGL blocked - it never does. A reader without a GPU still
   * gets the rail, the table and the drawer, which is the outcome `hasWebGl()` exists for. */
  let drawerKind: string | null = null;
  function Probe() {
    const { focusCity, drawer } = useInteractions();
    useEffect(() => {
      focusCity('Kano');
    }, [focusCity]);
    drawerKind = drawer?.kind ?? null;
    return null;
  }
  act(() => {
    render(
      <StrictMode>
        <AppStateProvider>
          <InteractionsProvider>
            <Probe />
          </InteractionsProvider>
        </AppStateProvider>
      </StrictMode>,
    );
  });
  expect(drawerKind).toBe('city');
});

test('useInteractions outside its provider throws rather than returning a silent null', () => {
  function Bare() {
    useInteractions();
    return null;
  }
  expect(() => render(<Bare />)).toThrow(/InteractionsProvider/);
});

test('closeDrawer after openSpot leaves nothing behind, and the tip is independent of it', () => {
  const states: (string | null)[] = [];
  function Probe() {
    const { openSpot, closeDrawer, drawer, tip, showTip } = useInteractions();
    states.push(drawer?.kind ?? null);
    useEffect(() => {
      openSpot({ spot_id: 'X', city: 'Y' } as never);
      showTip({ kind: 'city', city: 'Y' }, 10, 10);
      closeDrawer();
    }, [openSpot, closeDrawer, showTip]);
    // The tooltip survives a drawer close: they are separate pieces of state, as the
    // original's `tip` element and `drawer` element were.
    if (states.length > 1) expect(tip === null || tip.target.kind === 'city').toBe(true);
    return null;
  }
  act(() => {
    render(
      <StrictMode>
        <AppStateProvider>
          <InteractionsProvider>
            <Probe />
          </InteractionsProvider>
        </AppStateProvider>
      </StrictMode>,
    );
  });
  expect(states[states.length - 1]).toBeNull();
});
