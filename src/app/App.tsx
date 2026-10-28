/* The app shell: header, tab switching, and the three containers the later tasks fill in.
 *
 * Markup is transcribed from project/nigeria-suhi-dashboard.html lines 244-404. Spec §3 makes
 * that file the visual authority and Task 3's Playwright guard compares computed boxes per
 * selector, so every class name, id, inline style and non-breaking space here is deliberate.
 * An extra wrapper element is a fidelity failure, which is why Radix is used with `asChild`
 * throughout and why the two pickers are native <select> elements (see PICKERS below).
 *
 * Task 2 scope: the rail is an empty <aside class="rail">, and each panel carries its heading
 * and lede only. Rail groups are Task 4, the map is Tasks 6-7, panel contents are Tasks 8-10. */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { I18nProvider, useLang, useT, type Lang } from './I18nProvider';
import { ThemeProvider, useTheme, type Theme } from './ThemeProvider';
import { AppStateProvider, useAppState, type State, type Tab } from './state';
import { decodeState, useDeepLink } from './deeplink';
import { useSuhiData, type SuhiData } from './data';
import { Rail } from '../rail/Rail';
import type { BaseKey } from '../rail/BasemapSeg';
import { ZoomHint } from '../map/ZoomHint';
import { InteractionsProvider, useInteractions } from '../map/interactions';
import { Swipe } from '../map/Swipe';
import { Tooltip } from '../map/Tooltip';
import { Drawer } from '../map/Drawer';
import { Compare } from '../views/Compare';
import { Table } from '../views/Table';
import { Reports } from '../views/Reports';

/* ══ TASK 12 - MAPLIBRE IS LOADED ON DEMAND, AND IT IS THE WHOLE BUNDLE ══
 *
 * MEASURED before this change: `index.js` was 1,466 kB raw / 426 kB gzipped plus a separate
 * 506 kB / 145 kB gzipped worker, and MapLibre is essentially all of it - 338 references in the
 * bundle against React's 77. It was STATICALLY imported here, so a ministry officer opening the
 * Data table from a §8.4 deep link downloaded the entire map engine and the tile worker to
 * never put a pixel on screen.
 *
 * `MapStage` therefore sits behind a dynamic `import()`. Two properties make this cost nothing:
 *
 *  - THE MAP TAB IS THE DEFAULT, so the common path is unchanged: the chunk is requested in the
 *    same tick the shell mounts, in parallel with the three data fetches, and the fidelity guard
 *    still compares the Map tab with the map rendered. `#map` is a compared selector and the
 *    guard waits for it (tests/fidelity/pages.ts).
 *  - RULING 5 IS PRESERVED. The stage stays MOUNTED across tabs, so once the map exists it
 *    survives a trip to the table and back, with its instance, its viewport and its camera. The
 *    latch below is one-way: `mapWanted` goes true the first time the Map tab is shown and never
 *    goes back.
 *
 * THE LATCH IS SEEDED FROM THE URL, not from `tab`'s initial value, and that is the difference
 * between saving the download and only appearing to. `useDeepLink` applies `?tab=` in an effect
 * (Task 11, deliberately, so a type-validated link cannot flash the wrong tab), so the FIRST
 * render of a `?tab=table` link still has `tab === 'map'` - and a latch reading `tab` would
 * already be true by the time the link landed. `decodeState` is pure and is the single owner of
 * what a link means, so it is asked directly here rather than re-parsed.
 */
const MapStage = lazy(() => import('../map/MapStage').then((m) => ({ default: m.MapStage })));

/** Does this URL open on the Map tab? Read once, synchronously, before the first render. */
export function linkWantsMap(search: string): boolean {
  return (decodeState(new URLSearchParams(search)).tab ?? 'map') === 'map';
}

/** Which basemap a theme change reaches for, prototype line 561. */
export type ThemeBaseKey = 'dark' | 'light';

export interface AppProps {
  /** Test/composition seam: seeds the app state. Task 4 onward mutate it through `useAppState`. */
  initialState?: Partial<State>;
  /**
   * Ruling 7. `applyTheme` called `setBase(theme === 'nocturne' ? 'dark' : 'light')`, but
   * `setBase` is Task 6's. Until then a theme change calls this injected callback instead, so
   * the behaviour exists and is testable before the map does. MUST be referentially stable:
   * it is an effect dependency, and a fresh function each render would re-fire the effect.
   */
  onBaseFromTheme?: (key: ThemeBaseKey) => void;
  /**
   * Ruling 7, the other half. A click in the rail's basemap segment latches
   * `userPickedBase` and would call Task 6's `setBase`; until that exists it calls this.
   * `onBaseFromTheme` covers the theme-driven path, this one the reader-driven path, and
   * Task 6 collapses both into `setBase`.
   */
  onBasePicked?: (key: BaseKey) => void;
  /**
   * Test/composition seam. Passing data (or `null`) SUPPRESSES the fetch in `useSuhiData`
   * entirely, so component suites render the rail against fixtures instead of reaching for
   * /data/*.json over a network jsdom does not have.
   */
  data?: SuhiData | null;
}

const NOOP_BASE = () => {};

export default function App({
  initialState,
  onBaseFromTheme = NOOP_BASE,
  onBasePicked = NOOP_BASE,
  data,
}: AppProps = {}) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppStateProvider initial={initialState}>
          {/* Task 7. The tooltip, the drawer, the swipe position and the camera handle all sit
            * here rather than in `Shell`, because `#tip` is a SIBLING of `.app` (prototype line
            * 404) while `.drawer` is the last child of `.mapwrap` - no single component in the
            * transcribed markup contains both. See src/map/interactions.tsx. */}
          <InteractionsProvider>
            <Shell onBaseFromTheme={onBaseFromTheme} onBasePicked={onBasePicked} injectedData={data} />
          </InteractionsProvider>
        </AppStateProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function Shell({
  onBaseFromTheme,
  onBasePicked,
  injectedData,
}: {
  onBaseFromTheme: (key: ThemeBaseKey) => void;
  onBasePicked: (key: BaseKey) => void;
  injectedData?: SuhiData | null;
}) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [state, patch] = useAppState();
  const [tab, setTab] = useState<Tab>('map');
  /* The one-way latch above. Seeded from the URL so a `?tab=table` link never requests the map
   * chunk, flipped the first time the reader NAVIGATES to the Map tab.
   *
   * `prevTab` is what makes "navigates" different from "happens to be mounted on", and it is
   * load-bearing rather than defensive. `tab`'s initial value is `'map'` whatever the link says,
   * because `useDeepLink` applies `?tab=` in an effect - so an effect that simply read
   * `tab === 'map'` would latch on the first commit of every page, including the table link this
   * exists to spare, and the saving would be imaginary. Measured: it did, and two tests below
   * caught it. The first commit is therefore ignored outright; the seed has already decided it.
   * StrictMode's double mount runs this twice, which is why the guard is a stored tab rather
   * than a "first run" boolean - the second run sees `prevTab === tab` and does nothing. */
  const [mapWanted, setMapWanted] = useState(() => linkWantsMap(window.location.search));
  const prevTab = useRef<Tab | null>(null);
  useEffect(() => {
    if (prevTab.current === null || prevTab.current === tab) {
      prevTab.current = tab;
      return;
    }
    prevTab.current = tab;
    if (tab === 'map') setMapWanted(true);
  }, [tab]);
  const [framed, setFramed] = useState(false);
  const fetched = useSuhiData(injectedData === undefined);
  const data = injectedData === undefined ? fetched.data : injectedData;
  const error = injectedData === undefined ? fetched.error : null;

  /* Task 6's map. `mapApi` is the imperative surface the three zoom buttons in `.ovl.ov-tr`
   * drive - those buttons are part of the original's overlay markup, not of `#map`, so the
   * handlers that `initMap` attached to them (prototype lines 635-637) live here and reach the
   * map through the ref. It comes from the interactions context because Task 7's `focusCity`
   * needs the camera, the city scope and the drawer in one call. `exagFactor` is ruling 9's
   * disclosure travelling the other way: `#zoomHint` is a `.mapsub` in this markup, and the
   * factor is the only thing it needs from the map. */
  const { mapApi, focusCity, closeDrawer } = useInteractions();
  const [exagFactor, setExagFactor] = useState(1);
  const onFactorChange = useCallback((f: number) => setExagFactor(f), []);

  /* `baseKey` is the prototype's module-level `let baseKey='dark'` (line 577), lifted here
   * because two things write it: the theme effect below and the rail's basemap segment. One
   * owner, so the segment's aria-pressed and the theme's choice can never disagree. */
  const [baseKey, setBaseKey] = useState<BaseKey>('dark');

  /* Ruling 7, transcribed from `applyTheme` (prototype line 561): a theme change drags the
   * basemap with it, but ONLY while the reader has not chosen one.
   *
   * The guard is "have we already applied this key", not "is the latch set", and that is what
   * makes `userPickedBase` safe to list as a dependency. The latch flipping true re-runs this
   * effect, but it returns early, so the flip itself never moves the basemap - which is the
   * behaviour ruling 7 asks for. An earlier version read the latch from a ref assigned during
   * render to keep it out of the dependency array; that was both a render-phase side effect
   * (unsupported under concurrent rendering, where a discarded render still mutates the ref)
   * and not idempotent: #root is wrapped in StrictMode, whose deliberate double invocation
   * made boot call setBase TWICE. Harmless against a no-op stub, a double tile fetch against
   * Task 6's real setBase. `lastApplied` makes the effect idempotent, so the tests below can
   * run under StrictMode exactly as production does. */
  const lastApplied = useRef<ThemeBaseKey | null>(null);
  useEffect(() => {
    if (state.userPickedBase) return;
    const key: ThemeBaseKey = theme === 'nocturne' ? 'dark' : 'light';
    if (lastApplied.current === key) return;
    lastApplied.current = key;
    setBaseKey(key);
    onBaseFromTheme(key);
  }, [theme, state.userPickedBase, onBaseFromTheme]);

  /* Ruling 7's latch, set here and nowhere else. It is never cleared: once the reader has
   * chosen a basemap, their choice outlives every later theme change for the session. */
  const pickBase = useCallback(
    (key: BaseKey) => {
      setBaseKey(key);
      patch({ userPickedBase: true });
      onBasePicked(key);
    },
    [patch, onBasePicked],
  );

  /* SPEC §8.4, Task 11. Placed AFTER the theme effect and `pickBase` on purpose: effects run in
   * declaration order, so the theme effect has already applied its basemap by the time the link
   * applies the reader's, and `onPickBase: pickBase` then latches ruling 7 so the theme effect
   * cannot drag it back. Reversing the two would make `?theme=modernist&base=dark` lose its
   * basemap on the first commit. Nothing here renders, so the fidelity guard is unaffected. */
  /* Memoised because the hook lists both arrays as effect dependencies, and a fresh `.map()`
   * every render would re-register its popstate listener on every keystroke. */
  const linkCities = useMemo(() => data?.cities.map((c) => c.city), [data]);
  const linkClusters = useMemo(() => data?.clusters.map((k) => k.id), [data]);
  useDeepLink({ tab, setTab, base: baseKey, onPickBase: pickBase, cities: linkCities, clusters: linkClusters });

  const onTabChange = useCallback((value: string) => setTab(value as Tab), []);

  /* SPEC §9.1 BUG 8 - the aria-live half, for the tabs.
   *
   * Task 7 gave the drawer `#drawerLive`, so opening a spot is announced. A TAB CHANGE was
   * still silent, and it is the largest thing that happens on this page: the whole stage is
   * replaced. It is silent for a structural reason rather than an oversight - ruling 5 swaps
   * panels with `display`, so nothing navigates, no heading receives focus and no document
   * change occurs for a screen reader to notice. A sighted reader sees the page turn over; a
   * reader on a screen reader hears nothing at all.
   *
   * THE ANNOUNCEMENT IS THE TAB'S OWN LABEL AND NOTHING ELSE. "Data table" rather than
   * "Switched to the Data table tab": the surrounding prose would be a fifth string needing
   * Hausa, Igbo and Yorùbá, and §10.2 leaves those three under native review - so an invented
   * sentence here would be the one piece of copy on the page that no reviewer ever sees. The
   * tab labels are already in the dictionary, already reviewed as far as the rest is, and the
   * element's `role="tab"` tells the reader what kind of thing was just named.
   *
   * EMPTY AT BOOT. `tab`'s initial value is `'map'`, and an announcer seeded with it would talk
   * over the document title on load - the one thing a screen reader reads unasked. `?tab=table`
   * arriving in an effect (Task 11) IS a change and IS announced, which is correct: the reader
   * followed a link and should be told where it landed.
   *
   * THE REF STORES THE PREVIOUS TAB, NOT A "first run" BOOLEAN, for the reason the `mapWanted`
   * latch above spells out: #root is in StrictMode, the effect is invoked twice on mount, and a
   * boolean flipped by the first invocation lets the second one announce "Map" at boot. A
   * stored tab makes the second invocation a no-op because the tab has not changed. It also
   * means a LANGUAGE change alone announces nothing - `t` is in the dependency list because the
   * effect reads it, not because a new language is news about the tab. */
  const announced = useRef<Tab | null>(null);
  const [tabLive, setTabLive] = useState('');
  useEffect(() => {
    if (announced.current === null || announced.current === tab) {
      announced.current = tab;
      return;
    }
    announced.current = tab;
    setTabLive(t(`tab_${tab}`));
  }, [tab, t]);

  /* Prototype line 1130: a click on a table row does `selectTab('map')` AND `focusCity(…)`.
   * Assembled here because it is the only place that holds both the tab value and the camera -
   * `setTab` is this component's `useState`, `focusCity` comes from the interactions context.
   * Order matters: `focusCity` moves the camera, and a map that is still `display:none` has no
   * size to fit to, so the tab is switched first exactly as the original switches it. */
  const openCityFromTable = useCallback(
    (city: string) => {
      setTab('map');
      focusCity(city);
    },
    [focusCity],
  );

  /* Ruling 5: `selectTab` (prototype lines 1020-1026) sets `style.display` on the rail and the
   * stage. They stay MOUNTED on every tab - the map instance, its viewport and the rail's
   * filter state all have to survive a trip to the table and back - but they are hidden off the
   * Map tab, because a 332px rail was never designed to share a row with a full-width panel. */
  const offMap = tab !== 'map' ? { display: 'none' } : undefined;

  return (
    <>
      <Tabs.Root asChild value={tab} onValueChange={onTabChange}>
        <div className="app">
          <header className="top">
            <div className="brand">
              <b>{'SUHI Nigeria'}</b>
              <span data-i18n="composite">{t('composite')}</span>
            </div>
            <Tabs.List asChild>
              <nav className="tabs" role="tablist">
                <TabButton value="map" i18n="tab_map" />
                <TabButton value="compare" i18n="tab_compare" />
                <TabButton value="table" i18n="tab_table" />
                <TabButton value="report" i18n="tab_report" />
              </nav>
            </Tabs.List>
            <div className="sp"></div>
            {/* PICKERS. The brief asked for Radix Select styled as `.mini-sel`; these are native
             * <select> elements instead, and that is a fidelity decision, not a shortcut. A Radix
             * Select renders a <button> trigger plus a portalled listbox: the trigger would size
             * to the SELECTED label while a native select sizes to its WIDEST option (compare
             * "Modernist · light" with "Nocturne · dark"), so the `.mini-sel` box would not match
             * the original's, and app.css - a verbatim transcription - contains no rules for a
             * portalled popup. `.mini-sel` is also written for a native control: appearance:none
             * plus two background-image gradients draw the chevron a native select would draw. */}
            <div className="pickers">
              <select
                className="mini-sel"
                id="lang"
                title="Language"
                value={lang}
                /* Prototype line 1015: a language change closes the drawer. It has to - the
                 * original rebuilt the drawer's markup from the dictionary at open time and had
                 * no way to re-render it in place, and a panel half in English and half in
                 * Hausa is worse than a closed one. Ours WOULD re-render correctly, but the
                 * behaviour is the approved page's and is transcribed rather than improved. */
                onChange={(e) => {
                  setLang(e.target.value as Lang);
                  closeDrawer();
                }}
              >
                <option value="en">English</option>
                <option value="ha">Hausa</option>
                <option value="ig">Igbo</option>
                <option value="yo">Yorùbá</option>
              </select>
              <select
                className="mini-sel"
                id="theme"
                title="Theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                <option value="nocturne">Nocturne · dark</option>
                <option value="modernist">Modernist · light</option>
              </select>
            </div>
            <button
              className="ghost"
              id="frameToggle"
              aria-pressed={framed}
              data-i18n="framed"
              onClick={() => setFramed((on) => !on)}
            >
              {t('framed')}
            </button>
            <button className="ghost" id="exportBtn" data-i18n="export" onClick={() => setTab('report')}>
              {t('export')}
            </button>
          </header>

          <div className="body">
            {/* The element, its id and its display behaviour are Task 2's, because selectTab
             * addresses it by id; groups 1-5 inside it are Task 4's and 6-10 Task 5's. */}
            <aside className="rail" id="rail" style={offMap}>
              <Rail
                data={data}
                baseKey={baseKey}
                onPickBase={pickBase}
                /* Task 5 left these two as optional seams, noting that nothing imperative was
                 * lost because the map subscribes to state. These two ARE imperative: a camera
                 * move is not derivable from `state.city` (the same city can be re-picked, and
                 * `fitNation` has no state of its own), so they are the two real calls. */
                onFocusCity={focusCity}
                /* Prototype line 1005: `#scopeReset` clears the scope, refits and closes the
                 * drawer, exactly as `#zreset` does. */
                onResetScope={() => {
                  mapApi.current?.fitNation();
                  closeDrawer();
                }}
              />
            </aside>

            <main
              className={framed ? 'stage framed' : 'stage'}
              id="stage"
              /* `.stage.framed` in app.css is what changes the layout, and the original toggles
               * exactly that class (prototype line 1009). An earlier version also set a
               * `data-framed` attribute for convenient assertion; it was removed because the
               * original has no such attribute, nothing styles it, and a test reading it would
               * have been asserting our invention rather than the behaviour. */
              style={offMap}
            >
              <div className="mapwrap" id="mapwrap">
                {/* `fallback={null}` rather than a placeholder: `.mapwrap` already holds the
                  * `.loading` div below until the data lands, and a second spinner inside the
                  * same box would be a visible addition the original has no counterpart for.
                  * The chunk resolves in parallel with the three data fetches, so on the
                  * default tab there is nothing extra to wait for. */}
                {mapWanted ? (
                  <Suspense fallback={null}>
                    <MapStage data={data} baseKey={baseKey} onFactorChange={onFactorChange} />
                  </Suspense>
                ) : null}
                {/* The original REMOVED this element once Promise.all settled (prototype line
                  * 600) and wrote the failure into it from the `.catch` (line 607) - which
                  * could never work, because by then it had been removed and the handler threw
                  * writing to null, so the real cause never surfaced. Rendering it
                  * conditionally fixes both halves: it is gone the moment data lands, and an
                  * error has somewhere to be said. */}
                {data ? null : (
                  <div className="loading" id="loading">
                    {error ? `Could not load data: ${error.message}` : 'Loading geometry…'}
                  </div>
                )}
                {/* The two `.swipetag`s and the 2px handle, prototype lines 360-362. Ruling 35
                  * made the clip a property of the night map instance, so the component owns
                  * the position and `MapStage` owns the element it clips. */}
                <Swipe />
                <div className="ovl ov-tl">
                  <h1 className="mapttl" data-i18n="map_title">
                    {t('map_title')}
                  </h1>
                  <br />
                  <p className="mapsub" id="mapSub">
                    Getis-Ord Gi* contours · MODIS LST 2024
                  </p>
                  <br />
                  <ZoomHint factor={exagFactor} />
                </div>
                <div className="ovl ov-tr">
                  <button className="zbtn" id="zin" onClick={() => mapApi.current?.zoomIn()}>
                    +
                  </button>
                  <button className="zbtn" id="zout" onClick={() => mapApi.current?.zoomOut()}>
                    −
                  </button>
                  <button
                    className="zbtn"
                    id="zreset"
                    style={{ width: 'auto', padding: '0 8px', fontSize: '10.5px' }}
                    data-i18n="fit"
                    /* Prototype line 637: clear the city scope, refit the nation, close the
                     * drawer - all three. */
                    onClick={() => {
                      patch({ city: null });
                      mapApi.current?.fitNation();
                      closeDrawer();
                    }}
                  >
                    {t('fit')}
                  </button>
                </div>
                <Drawer data={data} />
              </div>
            </main>

            <section className="panel" id="panel-compare" data-on={tab === 'compare'}>
              <h2 data-i18n="tab_compare">{t('tab_compare')}</h2>
              <p className="lede" data-i18n="cmp_lede">
                {t('cmp_lede')}
              </p>
              {/* Task 8. Rendered on every tab, not only on this one: the panel is hidden with
                * display:none rather than unmounted (ruling 5), the original built every panel
                * at boot (prototype line 1175), and a tab that renders on first visit is a
                * different page from the one the fidelity guard measures. */}
              <Compare data={data} />
            </section>

            <section className="panel" id="panel-table" data-on={tab === 'table'}>
              <h2 data-i18n="tbl_title">{t('tbl_title')}</h2>
              <p className="lede" data-i18n="tbl_lede">
                {t('tbl_lede')}
              </p>
              {/* Task 9, mounted on every tab for Task 8's reason: the panel is hidden with
                * display:none rather than unmounted (ruling 5), the original built every panel
                * at boot, and a tab that renders on first visit is a different page from the
                * one the fidelity guard measures. */}
              <Table data={data} onOpenCity={openCityFromTable} />
            </section>

            <section className="panel" id="panel-report" data-on={tab === 'report'}>
              <h2 data-i18n="rep_title">{t('rep_title')}</h2>
              <p className="lede" data-i18n="rep_lede">
                {t('rep_lede')}
              </p>
              {/* Task 10, mounted on every tab for Task 8's reason: the panel is hidden with
                * display:none rather than unmounted (ruling 5), the original built every panel
                * at boot, and a tab that renders on first visit is a different page from the
                * one the fidelity guard measures. */}
              <Reports data={data} />
            </section>
          </div>
        </div>
      </Tabs.Root>
      {/* The shared tooltip, prototype line 404: one node outside `.app`, moved and filled by
       * whichever layer is hovered. */}
      <Tooltip data={data} />
      {/* §9.1 bug 8. OUTSIDE `.app`, beside the tooltip, for the same reason the tooltip is
        * there: `.app` and `.body` are flex containers whose children the fidelity guard
        * measures, and a new child of either would be a layout participant. `.sr-only` is
        * `position:absolute` and 1x1 (app.css), so this costs no pixel wherever it sits - but
        * "costs no pixel" is a property of the class, and being a sibling of `.app` rather than
        * a child of it is what makes that true without depending on the class. */}
      <div className="sr-only" id="tabLive" aria-live="polite" aria-atomic="true">
        {tabLive}
      </div>
    </>
  );
}

/* Radix gives the trigger role="tab", aria-selected and keyboard roving focus; the original's
 * class and data-tab are kept so the fidelity guard and selectTab-era selectors still match.
 * `aria-controls` is cleared because the original's buttons control nothing by id: the rail and
 * the stage are siblings of the panel set rather than tab panels, and the panels key off
 * data-on, not Radix's hidden attribute - see the Tabs note in the task 2 report. */
function TabButton({ value, i18n }: { value: Tab; i18n: string }) {
  const t = useT();
  return (
    <Tabs.Trigger asChild value={value}>
      <button className="tab" data-tab={value} data-i18n={i18n} aria-controls={undefined}>
        {t(i18n)}
      </button>
    </Tabs.Trigger>
  );
}
