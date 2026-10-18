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

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { I18nProvider, useLang, useT, type Lang } from './I18nProvider';
import { ThemeProvider, useTheme, type Theme } from './ThemeProvider';
import { AppStateProvider, useAppState, type State, type Tab } from './state';

/** Which basemap a theme change reaches for, prototype line 561. */
export type ThemeBaseKey = 'dark' | 'topo';

export interface AppProps {
  /** Test/composition seam: seeds the app state. Task 4 onward mutate it through `useAppState`. */
  initialState?: Partial<State>;
  /**
   * Ruling 7. `applyTheme` called `setBase(theme === 'nocturne' ? 'dark' : 'topo')`, but
   * `setBase` is Task 6's. Until then a theme change calls this injected callback instead, so
   * the behaviour exists and is testable before the map does. MUST be referentially stable:
   * it is an effect dependency, and a fresh function each render would re-fire the effect.
   */
  onBaseFromTheme?: (key: ThemeBaseKey) => void;
}

const NOOP_BASE = () => {};

export default function App({ initialState, onBaseFromTheme = NOOP_BASE }: AppProps = {}) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppStateProvider initial={initialState}>
          <Shell onBaseFromTheme={onBaseFromTheme} />
        </AppStateProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function Shell({ onBaseFromTheme }: { onBaseFromTheme: (key: ThemeBaseKey) => void }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [state] = useAppState();
  const [tab, setTab] = useState<Tab>('map');
  const [framed, setFramed] = useState(false);

  /* Ruling 7, transcribed from `applyTheme` (prototype line 561): a theme change drags the
   * basemap with it, but ONLY while the reader has not chosen one. `userPickedBase` is read
   * through a ref rather than listed as a dependency on purpose - the latch flipping true must
   * not itself be an event that moves the basemap, and the original's `if (!userPickedBase)`
   * sat inside applyTheme, which only ever ran on a theme change (and once at boot). */
  const pickedRef = useRef(state.userPickedBase);
  pickedRef.current = state.userPickedBase;
  useEffect(() => {
    if (!pickedRef.current) onBaseFromTheme(theme === 'nocturne' ? 'dark' : 'topo');
  }, [theme, onBaseFromTheme]);

  const onTabChange = useCallback((value: string) => setTab(value as Tab), []);

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
                onChange={(e) => setLang(e.target.value as Lang)}
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
            {/* Rail groups are Task 4's. The element itself, its id and its display behaviour are
             * Task 2's, because selectTab addresses it by id. */}
            <aside className="rail" id="rail" style={offMap}></aside>

            <main
              className={framed ? 'stage framed' : 'stage'}
              id="stage"
              /* `.stage.framed` in app.css is what actually changes the layout (prototype line
               * 1009 toggles the class). `data-framed` carries the same bit as an attribute so
               * the state is observable without reading a class list. Both, deliberately. */
              data-framed={framed}
              style={offMap}
            >
              <div className="mapwrap" id="mapwrap">
                <div id="map"></div>
                <div className="loading" id="loading">
                  Loading geometry…
                </div>
                <div className="swipetag" id="tagDay">
                  {t('day')} · LST
                </div>
                <div className="swipetag" id="tagNight">
                  {t('night')} · LST
                </div>
                <div className="swipe" id="swipe" style={{ left: '55%' }}>
                  <div className="grab">⇄</div>
                </div>
                <div className="ovl ov-tl">
                  <h1 className="mapttl" data-i18n="map_title">
                    {t('map_title')}
                  </h1>
                  <br />
                  <p className="mapsub" id="mapSub">
                    Getis-Ord Gi* contours · MODIS LST 2024
                  </p>
                  <br />
                  <p className="mapsub" id="zoomHint"></p>
                </div>
                <div className="ovl ov-tr">
                  <button className="zbtn" id="zin">
                    +
                  </button>
                  <button className="zbtn" id="zout">
                    −
                  </button>
                  <button
                    className="zbtn"
                    id="zreset"
                    style={{ width: 'auto', padding: '0 8px', fontSize: '10.5px' }}
                    data-i18n="fit"
                  >
                    {t('fit')}
                  </button>
                </div>
                <aside className="drawer" id="drawer" data-open="false"></aside>
              </div>
            </main>

            <section className="panel" id="panel-compare" data-on={tab === 'compare'}>
              <h2 data-i18n="tab_compare">{t('tab_compare')}</h2>
              <p className="lede" data-i18n="cmp_lede">
                {t('cmp_lede')}
              </p>
            </section>

            <section className="panel" id="panel-table" data-on={tab === 'table'}>
              <h2 data-i18n="tbl_title">{t('tbl_title')}</h2>
              <p className="lede" data-i18n="tbl_lede">
                {t('tbl_lede')}
              </p>
            </section>

            <section className="panel" id="panel-report" data-on={tab === 'report'}>
              <h2 data-i18n="rep_title">{t('rep_title')}</h2>
              <p className="lede" data-i18n="rep_lede">
                {t('rep_lede')}
              </p>
            </section>
          </div>
        </div>
      </Tabs.Root>
      {/* The shared tooltip, prototype line 404: one node outside `.app`, moved and filled by
       * whichever layer is hovered. Task 6 onward write to it. */}
      <div className="tip" id="tip"></div>
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
