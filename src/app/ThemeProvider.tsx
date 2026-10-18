/* Theme plumbing. Transcribes the original's `applyTheme` (prototype lines 556-564) minus the
 * parts later tasks own.
 *
 * The provider sets `document.documentElement.dataset.theme` AND NOTHING ELSE to the document:
 * every colour, radius, shadow, font and rule width in the dashboard is a CSS custom property
 * under `html[data-theme=...]`, so flipping that one attribute repaints the whole UI. Resist
 * adding theme branches in JS.
 *
 * `paintEpoch` exists because the map is the one consumer that does NOT re-read CSS on its own:
 * MapLibre paint expressions are resolved hex values baked into a style object, so Task 7
 * subscribes to this counter to re-derive them. Nothing else should need it. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readStoredEnum, writeStored } from './persist';

export type Theme = 'nocturne' | 'modernist';

export const THEMES: readonly Theme[] = ['nocturne', 'modernist'];

/** localStorage key and default, ruling 6. */
export const THEME_KEY = 'suhi.theme';
export const DEFAULT_THEME: Theme = 'nocturne';

export interface ThemeApi {
  theme: Theme;
  setTheme: (next: Theme) => void;
  /** Increments on every theme change. Task 7's MapLibre paint re-derivation subscribes to it. */
  paintEpoch: number;
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // theme and paintEpoch move together, in ONE state object with a pure updater. Bumping the
  // epoch from inside a second setState (or writing to localStorage from the updater) would
  // double-count under StrictMode's deliberate double invocation.
  const [{ theme, paintEpoch }, setThemeState] = useState<{ theme: Theme; paintEpoch: number }>(() => ({
    theme: readStoredEnum(THEME_KEY, THEMES, DEFAULT_THEME),
    paintEpoch: 0,
  }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Persist only on a real change (epoch 0 is the value we just read back), so a boot never
  // writes the default over whatever a future version might have stored.
  useEffect(() => {
    if (paintEpoch > 0) writeStored(THEME_KEY, theme);
  }, [theme, paintEpoch]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState((prev) => (prev.theme === next ? prev : { theme: next, paintEpoch: prev.paintEpoch + 1 }));
  }, []);

  const api = useMemo<ThemeApi>(() => ({ theme, setTheme, paintEpoch }), [theme, setTheme, paintEpoch]);
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);
  if (!api) throw new Error('useTheme must be used inside <ThemeProvider>');
  return api;
}
