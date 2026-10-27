/* Spec §8.4 — deep links. A NEW FEATURE, approved by the user on 2026-10-26, not a
 * transcription: the original has zero URL state in its 1,179 lines (no `location`, no
 * `history`, no `URLSearchParams`, no `pushState`, no hash handling). It renders nothing, so it
 * costs no pixel and needs no `ALLOWED_DIFFS` entry.
 *
 * WHAT IT IS FOR. §8.4's own justification: a screenshot in a ministry memo is only
 * reproducible if the reader can get back to the view it was taken from. Eight things decide
 * that view — city, contour level, cluster, year, theme, language, basemap and the
 * swipe-divider position — and all eight travel here. There is NO `density` parameter: §11
 * records the density control revision 1 added as rejected, and an earlier draft of §8.4 listed
 * it by mistake. Encoding a control that does not exist would be inventing one.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * A DEEP LINK IS UNTRUSTED INPUT, AND THAT IS THE LOAD-BEARING HALF OF THIS FILE.
 *
 * Anyone can type anything into a query string, and the values here reach a MapLibre filter
 * expression, a `d3.format` call and a Sen-slope back-cast. So `decodeState` is a whitelist, not
 * a parser: every parameter is checked against the vocabulary its control actually offers, and
 * ANYTHING that does not match is DROPPED, leaving the default in place. Unknown parameter
 * names are ignored for the same reason — they are not errors, they are noise, and a link that
 * throws is worse than a link that loses a filter.
 *
 * The first real case already exists and is not hypothetical. RULING 39 cut the basemap from
 * five Esri providers to two vector grounds, `dark` and `light`. Every link minted while the
 * segment still offered `plain`, `topo`, `gray`, `relief` or `imagery` carries a `base=` value
 * that is now meaningless, and those links are in people's bookmarks and in draft memos.
 * `base=plain` therefore has to fall BACK to the theme's own ground, silently, not break the
 * map and not leave the basemap segment pointing at an option that is not there. That is what
 * the vocabulary check buys: the valid set is `BASE_KEYS`, which ruling 39 is the single owner
 * of, so the day a variant is added or removed the decoder follows with no edit here.
 *
 * `city` and `cluster` are checked against the LOADED DATA rather than a pattern, and when no
 * vocabulary is supplied they are dropped rather than trusted. A plausible-looking
 * `?city=Springfield` is exactly as wrong as `?city=<script>` and gets the same treatment. This
 * is why `decodeState` takes a `Vocabulary`: it is a pure function of its arguments, with no
 * hidden dependency on whether `data/cities.json` happens to have landed yet.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * HISTORY: PUSH FOR A DECISION, REPLACE FOR A DRAG. The year slider and the swipe divider are
 * continuous controls. Dragging the year from 2024 to 2015 fires nine change events and
 * dragging the divider across the map fires dozens; pushing each one buries the back button
 * under forty entries that the reader has to press through to leave the page. So a change to
 * `year` or `swipe` ALONE replaces the current entry, and any other change — a city, a tab, a
 * theme, a contour level — pushes one. `historyMode` is that rule as a pure function over the
 * two parameter sets, so it can be tested without a history stack.
 */

import { useCallback, useEffect, useRef } from 'react';
import { CONTOURS, INITIAL_STATE, TABS, useAppState, type Contour, type State, type Tab } from './state';
import { DEFAULT_THEME, THEMES, useTheme, type Theme } from './ThemeProvider';
import { DEFAULT_LANG, useLang, type Lang } from './I18nProvider';
import { LANGS } from '../i18n/dictionary.mjs';
import { BASE_KEYS, type BaseKey } from '../map/style';
import { SWIPE_DEFAULT, SWIPE_MAX, SWIPE_MIN } from '../map/Swipe';
import { useInteractions } from '../map/interactions';
import { YEAR_MAX, YEAR_MIN } from '../rail/YearSlider';

/** The four parameters that are not in `State`: they live in the two providers, in `Shell`'s
 * own `useState` and in the interactions context. §8.4 lists all eight together, so they are
 * encoded together. */
export interface LinkView {
  readonly tab: Tab;
  readonly theme: Theme;
  readonly lang: Lang;
  readonly base: BaseKey;
  /** The 0-1 fraction, as `swipePct` holds it — not a percentage. */
  readonly swipe: number;
}

/** What `decodeState` returns: the brief's `Partial<State> & { tab?: Tab }`, widened to the
 * other three §8.4 fields. Every key is optional because every key is droppable. */
export type DecodedLink = Partial<State> & Partial<LinkView>;

/** The two vocabularies that come from the loaded data rather than from a type. Absent means
 * "cannot be validated", which means the parameter is dropped. */
export interface Vocabulary {
  readonly cities?: readonly string[];
  readonly clusters?: readonly (string | number)[];
}

/** Parameter names. Short, because these go in memos and get retyped by hand. */
export const PARAM = {
  tab: 'tab',
  city: 'city',
  contour: 'contour',
  cluster: 'cluster',
  year: 'year',
  theme: 'theme',
  lang: 'lang',
  base: 'base',
  swipe: 'swipe',
} as const;

/** The parameters a CONTINUOUS control writes. A change confined to these replaces the history
 * entry; see the header note. */
export const CONTINUOUS_PARAMS: readonly string[] = [PARAM.year, PARAM.swipe];

/** Every name this app recognises. Anything else in the query string is somebody else's
 * (a campaign tag, an analytics id) and is left strictly alone — dropped from our encoding,
 * never an error on decode. */
export const KNOWN_PARAMS: readonly string[] = Object.values(PARAM);

/* ── encode ────────────────────────────────────────────────────────────────────────────────── */

/** Four decimal places of the 0-1 fraction: 0.0001 of 1440px is a seventh of a pixel, so the
 * printed URL is exact to well under what anyone can see, and it stays short enough to retype.
 * Encoding the raw float would put `0.5500000000000001` in a memo. */
export const swipeParam = (pct: number): string => String(Math.round(pct * 1e4) / 1e4);

/**
 * The current view as a query string. Defaults are OMITTED, so the common case is a short URL
 * and `?` alone means "the page as it opens".
 *
 * Two deliberate asymmetries:
 *
 * - `theme` and `lang` are ALWAYS written, default or not. They are the two values that also
 *   persist in localStorage (ruling 6), so a link that omits `theme=nocturne` renders in
 *   Modernist for a reader who last chose Modernist — and §8.4 exists to make a screenshot
 *   reproducible by *whoever reads the memo*, not only by the person who took it.
 * - `base` is written only once `userPickedBase` is latched (ruling 7). Until then the basemap
 *   is a function of the theme, which is already in the URL, so writing it would be writing a
 *   derived value — and a `base=` the reader never chose would latch the ruling 7 flag on the
 *   far end and freeze their basemap against their own later theme changes.
 */
export function encodeState(s: State, view: LinkView): URLSearchParams {
  const p = new URLSearchParams();
  if (view.tab !== 'map') p.set(PARAM.tab, view.tab);
  if (s.city) p.set(PARAM.city, s.city);
  if (s.contour !== INITIAL_STATE.contour) p.set(PARAM.contour, s.contour);
  if (s.cluster !== INITIAL_STATE.cluster) p.set(PARAM.cluster, s.cluster);
  if (s.year !== INITIAL_STATE.year) p.set(PARAM.year, String(s.year));
  p.set(PARAM.theme, view.theme);
  p.set(PARAM.lang, view.lang);
  if (s.userPickedBase) p.set(PARAM.base, view.base);
  if (view.swipe !== SWIPE_DEFAULT) p.set(PARAM.swipe, swipeParam(view.swipe));
  return p;
}

/** `encodeState` as the string `window.location.search` wants, `?` included (or `''` when
 * empty, which cannot happen while theme and lang are unconditional but is still the honest
 * answer for an empty set). */
export function linkSearch(s: State, view: LinkView): string {
  const q = encodeState(s, view).toString();
  return q ? `?${q}` : '';
}

/* ── decode ────────────────────────────────────────────────────────────────────────────────── */

const inList = <T extends string>(raw: string | null, allowed: readonly T[]): T | undefined =>
  raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;

/** An integer in `[lo, hi]`, or `undefined`. Rejects `''`, `'20x4'`, `'2019.5'`, `'1e3'`,
 * `'NaN'`, `'Infinity'` and `'  2019  '` — `Number.parseInt` would accept the second and the
 * last, which is how `?year=2019abc` would otherwise reach the back-cast. */
function intIn(raw: string | null, lo: number, hi: number): number | undefined {
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= lo && n <= hi ? n : undefined;
}

/** A finite float in `[lo, hi]`, or `undefined`. Out of range is DROPPED rather than clamped:
 * §8.4 says an out-of-range value falls back to the default, and a clamp would silently honour
 * `?swipe=99` as "hard right", which is a different view from the one the link asked for and
 * indistinguishable from a typo. */
function floatIn(raw: string | null, lo: number, hi: number): number | undefined {
  if (raw === null || !/^-?(\d+\.?\d*|\.\d+)$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
}

/**
 * A query string as the subset of state it legitimately names. See the header: this is a
 * whitelist, and anything unrecognised is dropped rather than reported.
 *
 * `vocab` carries the two values that only the loaded data can validate. Omit it and `city` and
 * `cluster` are dropped — "cannot be checked" is treated as "not valid", because the
 * alternative is pattern-matching a city name, and `?city=Springfield` looks exactly as
 * plausible as `?city=Ibadan` to a regular expression.
 */
export function decodeState(params: URLSearchParams, vocab: Vocabulary = {}): DecodedLink {
  const out: Record<string, unknown> = {};

  const tab = inList(params.get(PARAM.tab), TABS);
  if (tab) out.tab = tab;

  const contour = inList<Contour>(params.get(PARAM.contour), CONTOURS);
  if (contour) out.contour = contour;

  const theme = inList(params.get(PARAM.theme), THEMES);
  if (theme) out.theme = theme;

  const lang = inList(params.get(PARAM.lang), LANGS as readonly Lang[]);
  if (lang) out.lang = lang;

  /* RULING 39's own fallback. `BASE_KEYS` is `dark` and `light`; `base=plain` and `base=topo`
   * were valid a day ago and now are not, and they land here. */
  const base = inList(params.get(PARAM.base), BASE_KEYS);
  if (base) out.base = base;

  const year = intIn(params.get(PARAM.year), YEAR_MIN, YEAR_MAX);
  if (year !== undefined) out.year = year;

  const swipe = floatIn(params.get(PARAM.swipe), SWIPE_MIN, SWIPE_MAX);
  if (swipe !== undefined) out.swipe = swipe;

  const city = params.get(PARAM.city);
  if (city !== null && vocab.cities?.includes(city)) out.city = city;

  const cluster = params.get(PARAM.cluster);
  if (cluster === 'all') out.cluster = cluster;
  else if (cluster !== null && vocab.clusters?.some((id) => String(id) === cluster)) out.cluster = cluster;

  return out as DecodedLink;
}

/* ── history ───────────────────────────────────────────────────────────────────────────────── */

export type HistoryMode = 'push' | 'replace';

/** Which parameter names differ between two sets, in sorted order. A value change, an added
 * name and a removed name all count. */
export function changedParams(prev: URLSearchParams, next: URLSearchParams): string[] {
  const names = new Set([...prev.keys(), ...next.keys()]);
  return [...names].filter((k) => prev.get(k) !== next.get(k)).sort();
}

/**
 * `replace` when nothing changed, or when the only things that changed are the continuous
 * controls; `push` otherwise. See the header note for why — a nine-event year drag must leave
 * the back button one press from where the reader came in.
 */
export function historyMode(prev: URLSearchParams, next: URLSearchParams): HistoryMode {
  const changed = changedParams(prev, next);
  return changed.every((k) => CONTINUOUS_PARAMS.includes(k)) ? 'replace' : 'push';
}

/* ── wiring ────────────────────────────────────────────────────────────────────────────────── */

export interface DeepLinkOptions {
  readonly tab: Tab;
  readonly setTab: (tab: Tab) => void;
  readonly base: BaseKey;
  /**
   * `Shell`'s `pickBase`, which LATCHES `userPickedBase` (ruling 7). A basemap that arrived in a
   * link is a basemap the reader chose, so it has to latch: without the latch, `Shell`'s theme
   * effect would immediately drag `?theme=modernist&base=dark` back to `light` and the link's
   * own basemap would never survive its first render.
   */
  readonly onPickBase: (key: BaseKey) => void;
  /** The loaded vocabularies. `undefined` while the fetch is in flight. */
  readonly cities?: readonly string[];
  readonly clusters?: readonly (string | number)[];
}

/**
 * Reads the entry URL once, then keeps the URL in step with the view.
 *
 * TWO PHASES, because the two vocabularies arrive late. Everything that a type can validate —
 * tab, theme, language, basemap, contour level, year, divider — is applied on mount, so the
 * page does not paint in the wrong theme and then correct itself. `city` and `cluster` wait for
 * `data/cities.json` and `data/clusters.json`, because until those land there is nothing to
 * check them against (see `decodeState`). Both phases are latched by a ref: StrictMode invokes
 * every effect twice on mount by design, and an applier that is not idempotent would, for
 * instance, push a second history entry on boot.
 *
 * The writer effect is last, and it converges because it writes exactly `linkSearch(state)` and
 * compares against `location.search` before writing anything at all. The FIRST write always
 * replaces: an entry URL carrying a stale `base=plain`, or a campaign tag we drop, normalises
 * to a different string, and normalising is not navigation.
 */
export function useDeepLink({ tab, setTab, base, onPickBase, cities, clusters }: DeepLinkOptions): void {
  const [state, patch] = useAppState();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLang();
  const { swipePct, setSwipePct } = useInteractions();

  const appliedTyped = useRef(false);
  const appliedData = useRef(false);
  const firstWrite = useRef(true);

  /** Applies a decoded link. Used by both phases and by the popstate handler. */
  const apply = useCallback(
    (link: DecodedLink) => {
      const next: Partial<State> = {};
      if (link.contour !== undefined) next.contour = link.contour;
      if (link.year !== undefined) next.year = link.year;
      if (link.cluster !== undefined) next.cluster = link.cluster;
      if (link.city !== undefined) next.city = link.city;
      if (Object.keys(next).length > 0) patch(next);
      if (link.tab !== undefined) setTab(link.tab);
      if (link.theme !== undefined) setTheme(link.theme);
      if (link.lang !== undefined) setLang(link.lang);
      if (link.swipe !== undefined) setSwipePct(link.swipe);
      if (link.base !== undefined) onPickBase(link.base);
    },
    [patch, setTab, setTheme, setLang, setSwipePct, onPickBase],
  );

  /* Phase 1 — everything a type can validate, on mount. */
  useEffect(() => {
    if (appliedTyped.current) return;
    appliedTyped.current = true;
    apply(decodeState(new URLSearchParams(window.location.search)));
  }, [apply]);

  /* Phase 2 — `city` and `cluster`, once there is something to check them against. */
  useEffect(() => {
    if (appliedData.current) return;
    if (!cities?.length && !clusters?.length) return;
    appliedData.current = true;
    const link = decodeState(new URLSearchParams(window.location.search), { cities, clusters });
    apply({ city: link.city, cluster: link.cluster });
  }, [apply, cities, clusters]);

  /* The back and forward buttons. Without this the pushed entries would change the address bar
   * and nothing else, which is a worse back button than none: it would look like it worked. */
  useEffect(() => {
    const onPop = () => {
      apply(decodeState(new URLSearchParams(window.location.search), { cities, clusters }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [apply, cities, clusters]);

  /* The writer. Runs after both appliers on every commit, so it never races them: on boot it
   * sees the state the link just produced and writes the same string back. */
  useEffect(() => {
    if (!appliedTyped.current) return;
    const next = encodeState(state, { tab, theme, lang, base, swipe: swipePct });
    const prev = new URLSearchParams(window.location.search);
    const q = next.toString();
    if (prev.toString() === q) return;
    const mode = firstWrite.current ? 'replace' : historyMode(prev, next);
    firstWrite.current = false;
    const url = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, [state, tab, theme, lang, base, swipePct]);
}

/** The defaults a dropped parameter falls back to, as one record — for the tests, and so the
 * fallback set is stated once rather than implied by six separate `INITIAL_STATE` reads. */
export const LINK_DEFAULTS = {
  tab: 'map' as Tab,
  city: INITIAL_STATE.city,
  contour: INITIAL_STATE.contour,
  cluster: INITIAL_STATE.cluster,
  year: INITIAL_STATE.year,
  theme: DEFAULT_THEME,
  lang: DEFAULT_LANG,
  swipe: SWIPE_DEFAULT,
} as const;
