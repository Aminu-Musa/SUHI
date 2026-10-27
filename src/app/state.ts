/* The original's `state` object, typed. Prototype lines 573-574 plus `userPickedBase` from
 * line 577, which lived in a module-level `let` next to `baseKey` rather than inside `state`.
 *
 * Shape and initial values are transcribed, not designed. `opacity` really is the 0-1 fraction
 * .85 while the rail's range input is 20-100 (prototype line 308); `contour: 'all'` means
 * "draw every level nested", not "no filter"; `cluster: 'all'` is a sentinel string, not null,
 * while `city: null` is a real null. Do not normalise any of that - Tasks 4-10 read these
 * values back out and the prototype's own code is the reference for what they mean.
 *
 * `userPickedBase` is the ruling 7 latch: false until the reader clicks anything in the basemap
 * segment, true forever after (prototype line 665 sets it; nothing ever resets it). While it is
 * false a theme change drags the basemap along; once true the reader's choice wins for the rest
 * of the session. Task 4 wires the segment that sets it; Task 6 implements setBase. */

import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Tab = 'map' | 'compare' | 'table' | 'report';

export type Contour = 'all' | 'L50' | 'L75' | 'L90';

/** The same four values as a runtime list, for anything that has to VALIDATE a `Contour`
 * rather than hold one — spec §8.4's deep link decoder is the first such caller, and an
 * unknown level arriving from a URL has to be recognised as unknown. It lives beside the type
 * because the type is the thing it has to stay in step with; `ContourSeg`'s own option list
 * pairs these values with labels and is a different concern (the labels are hard-coded English
 * in the original). `TABS` is here for the same reason. */
export const CONTOURS: readonly Contour[] = ['all', 'L50', 'L75', 'L90'];

export const TABS: readonly Tab[] = ['map', 'compare', 'table', 'report'];
export type PopMode = 'both' | 'hot' | 'cold';
export type CircleMetric = 'pop' | 'area';
export type LayerKey = 'spots' | 'exag' | 'cities' | 'states' | 'nation' | 'labels';

export interface State {
  contour: Contour;
  year: number;
  cluster: string;
  /** 0-1 fraction, as in the original. The rail's slider is 20-100 and divides by 100. */
  opacity: number;
  city: string | null;
  popMode: PopMode;
  circleMetric: CircleMetric;
  /** Ruling 7. Set true by any basemap-segment click, never reset. */
  userPickedBase: boolean;
  layers: Record<LayerKey, boolean>;
}

export const INITIAL_STATE: State = {
  contour: 'all',
  year: 2024,
  cluster: 'all',
  opacity: 0.85,
  city: null,
  popMode: 'both',
  circleMetric: 'pop',
  userPickedBase: false,
  layers: { spots: true, exag: true, cities: true, states: true, nation: true, labels: true },
};

export type AppStateApi = [State, (patch: Partial<State>) => void];

const AppStateContext = createContext<AppStateApi | null>(null);

export function AppStateProvider({ children, initial }: { children: ReactNode; initial?: Partial<State> }) {
  const [state, setState] = useState<State>(() => ({ ...INITIAL_STATE, ...initial }));
  const patch = useCallback((next: Partial<State>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);
  const api = useMemo<AppStateApi>(() => [state, patch], [state, patch]);
  return createElement(AppStateContext.Provider, { value: api }, children);
}

export function useAppState(): AppStateApi {
  const api = useContext(AppStateContext);
  if (!api) throw new Error('useAppState must be used inside <AppStateProvider>');
  return api;
}
