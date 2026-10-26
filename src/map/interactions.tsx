/* The map's interaction state, in one place: the hover tooltip, the drawer target, the swipe
 * position and the camera handle. Replaces the original's module-level `let swipePct`, its
 * `drawer.innerHTML = …` calls and its `tip` singleton (prototype lines 827-956).
 *
 * WHY A CONTEXT RATHER THAN PROPS. Five unrelated places drive this state and they are not
 * related by the component tree:
 *
 *   `#tip`                  a sibling of `.app`, outside the whole shell (prototype line 404)
 *   `.drawer`               the last child of `.mapwrap`
 *   `#map` / `#mapNight`    hover and click on the spot layers, and `map.on('click', closeDrawer)`
 *   `.citycircle`           hover and click on the DOM overlay (ruling 13)
 *   the rail and `#zreset`  `focusCity` from the search box, `closeDrawer` from Fit (line 636)
 *
 * Threading five callbacks and three pieces of state through `Shell` -> `main.stage` ->
 * `MapStage` would put the plumbing in the markup, and the markup is a transcription.
 *
 * `mapApi` LIVES HERE TOO, and that is the one piece that looks out of place. `focusCity` is
 * three things at once in the original (line 818): it sets the city scope, it moves the camera,
 * and it opens the city drawer. Two of those are state and one is imperative, so either the
 * camera handle comes into this context or `focusCity` has to be assembled at the only place
 * that can see both - which is exactly the prop-threading this context exists to avoid. The
 * zoom buttons then reach the map through the same ref, which is also where they were.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAppState } from '../app/state';
import type { SpotProperties } from '../app/data';
import type { MapApi } from './MapStage';
import { SWIPE_DEFAULT, clampSwipe } from './Swipe';

/* `showTip` CLAMPS TO THE VIEWPORT WITH TWO MAGIC NUMBERS, AND THEY STAY MAGIC (line 853-855).
 *
 *   left = min(window.innerWidth  - 256, clientX + 14)
 *   top  = min(window.innerHeight - 190, clientY + 14)
 *
 * 256 is `.tip{max-width:240px}` plus its 11px horizontal padding on both sides, rounded up;
 * 190 is a standing allowance for the tallest tooltip (`spotTip`'s four-row `dl` plus two note
 * lines). Measuring the element instead - `tip.offsetWidth`, `tip.offsetHeight` - would be the
 * obvious "fix" and is wrong twice over: it reads the PREVIOUS tooltip's size on the frame the
 * content changes, and it makes the clamp depend on the hovered feature's text, so the tooltip
 * would stop tracking the pointer consistently near an edge. The original's constants are
 * conservative and stable. Reproduced, not corrected.
 *
 * Note both are `min` only: the tooltip is never pushed off the LEFT or TOP, because the offset
 * is +14 from a pointer that is already inside the window. */
export const TIP_CLAMP_RIGHT = 256;
export const TIP_CLAMP_BOTTOM = 190;
export const TIP_OFFSET = 14;

export interface Viewport {
  readonly innerWidth: number;
  readonly innerHeight: number;
}

export interface TipPosition {
  readonly left: number;
  readonly top: number;
}

/** Prototype lines 853-855, exactly. `window` is a parameter so this is a pure function. */
export function clampTip(clientX: number, clientY: number, view: Viewport): TipPosition {
  return {
    left: Math.min(view.innerWidth - TIP_CLAMP_RIGHT, clientX + TIP_OFFSET),
    top: Math.min(view.innerHeight - TIP_CLAMP_BOTTOM, clientY + TIP_OFFSET),
  };
}

/** What the tooltip is showing. The CONTENT is a discriminated record rather than rendered
 * markup, so a pointermove stores two numbers and a reference instead of a fresh JSX tree. */
export type TipTarget =
  | { readonly kind: 'spot'; readonly spot: SpotProperties }
  | { readonly kind: 'city'; readonly city: string };

export interface TipState extends TipPosition {
  readonly target: TipTarget;
  /* `hideTip` SETS THIS FALSE RATHER THAN CLEARING THE STATE, because the original's `hideTip`
   * set `opacity` and nothing else (prototype line 864). The last position has to survive a
   * hide: without it the tooltip falls back to its static position while invisible and then
   * fades in at the pointer, which is a visible jump through `.tip`'s `.1s` opacity
   * transition on every single re-hover. */
  readonly visible: boolean;
}

/** What the drawer is showing. `openSpot` takes the whole record (prototype line 878);
 * `openCity` takes a name and looks the city up, as the original does (line 917). */
export type DrawerTarget =
  | { readonly kind: 'spot'; readonly spot: SpotProperties }
  | { readonly kind: 'city'; readonly city: string };

export interface InteractionsApi {
  /** Filled by `MapStage` on boot; read by the zoom buttons and by `focusCity`. */
  readonly mapApi: RefObject<MapApi | null>;
  readonly tip: TipState | null;
  showTip(target: TipTarget, clientX: number, clientY: number): void;
  hideTip(): void;
  readonly drawer: DrawerTarget | null;
  openSpot(spot: SpotProperties): void;
  openCity(city: string): void;
  closeDrawer(): void;
  /** Prototype line 818: scope, camera and drawer together. */
  focusCity(city: string): void;
  /** 0-1 fraction of `.mapwrap`'s width. Prototype line 828's `swipePct`. */
  readonly swipePct: number;
  setSwipePct(pct: number): void;
  /** A RELATIVE move, for the handle's arrow keys. Applied inside the state updater, because
   * React batches and two key events in one tick would otherwise both read the same captured
   * `swipePct` and the second press would be lost. */
  nudgeSwipe(delta: number): void;
}

const InteractionsContext = createContext<InteractionsApi | null>(null);

export function InteractionsProvider({ children }: { children: ReactNode }) {
  const [, patch] = useAppState();
  const mapApi = useRef<MapApi | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [swipePct, setPct] = useState(SWIPE_DEFAULT);

  const showTip = useCallback((target: TipTarget, clientX: number, clientY: number) => {
    setTip({ target, visible: true, ...clampTip(clientX, clientY, window) });
  }, []);
  const hideTip = useCallback(() => setTip((prev) => (prev ? { ...prev, visible: false } : null)), []);

  const openSpot = useCallback((spot: SpotProperties) => setDrawer({ kind: 'spot', spot }), []);
  const openCity = useCallback((city: string) => setDrawer({ kind: 'city', city }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const focusCity = useCallback(
    (city: string) => {
      /* The original's order, and it matters: `state.city = name` BEFORE the camera move, so
       * the spot filter has already narrowed to this city by the time the bounds are applied,
       * and `openCity` last so the drawer lands on a map that is already framed. */
      patch({ city });
      mapApi.current?.focusCity(city);
      setDrawer({ kind: 'city', city });
    },
    [patch],
  );

  const setSwipePct = useCallback((pct: number) => setPct(clampSwipe(pct)), []);
  const nudgeSwipe = useCallback((delta: number) => setPct((prev) => clampSwipe(prev + delta)), []);

  const api = useMemo<InteractionsApi>(
    () => ({
      mapApi,
      tip,
      showTip,
      hideTip,
      drawer,
      openSpot,
      openCity,
      closeDrawer,
      focusCity,
      swipePct,
      setSwipePct,
      nudgeSwipe,
    }),
    [tip, showTip, hideTip, drawer, openSpot, openCity, closeDrawer, focusCity, swipePct, setSwipePct, nudgeSwipe],
  );
  return <InteractionsContext.Provider value={api}>{children}</InteractionsContext.Provider>;
}

export function useInteractions(): InteractionsApi {
  const api = useContext(InteractionsContext);
  if (!api) throw new Error('useInteractions must be used inside <InteractionsProvider>');
  return api;
}
