/* Spec §8.4's encoder and decoder. No DOM: these are pure functions over `URLSearchParams`,
 * which Node has natively, so this suite runs in the default `node` environment. The wiring —
 * the two appliers, the writer and the history mode in practice — is `deeplink.sync.test.tsx`,
 * which needs jsdom and a real history stack.
 *
 * THE VALIDATION TESTS ARE THE LOAD-BEARING ONES. A deep link is untrusted input and these
 * values reach a MapLibre filter expression, a `d3.format` call and a Sen-slope back-cast, so
 * each one asserts that a bad value is ABSENT from the decoded object — not that it was
 * corrected, not that it threw. Absent is what makes the caller fall back to `INITIAL_STATE`,
 * and `LINK_DEFAULTS` is asserted against `INITIAL_STATE` below so "the default" means one
 * thing in both files.
 */

import { expect, test } from 'vitest';
import {
  CONTINUOUS_PARAMS,
  KNOWN_PARAMS,
  LINK_DEFAULTS,
  changedParams,
  decodeState,
  encodeState,
  historyMode,
  linkSearch,
  swipeParam,
  type LinkView,
} from './deeplink';
import { INITIAL_STATE, type State } from './state';
import { BASE_KEYS } from '../map/style';
import { SWIPE_DEFAULT, SWIPE_MAX, SWIPE_MIN } from '../map/Swipe';
import { YEAR_MAX, YEAR_MIN } from '../rail/YearSlider';
import citiesJson from '../../data/cities.json';
import clustersJson from '../../data/clusters.json';

/* The REAL vocabularies, through Vite's JSON transform rather than node:fs - @types/node is
 * deliberately not installed (see src/rail/fixtures.ts). `FIXTURE` is not used here because it
 * also parses a megabyte of polygons this suite has no use for. */
const CITY_NAMES = (citiesJson as unknown as { city: string }[]).map((c) => c.city);
const CLUSTER_IDS = (clustersJson as unknown as { id: number }[]).map((k) => k.id);
const VOCAB = { cities: CITY_NAMES, clusters: CLUSTER_IDS };

const DEFAULT_VIEW: LinkView = {
  tab: 'map',
  theme: 'nocturne',
  lang: 'en',
  base: 'dark',
  swipe: SWIPE_DEFAULT,
};

const p = (search: string) => new URLSearchParams(search);

/* ── round trips ───────────────────────────────────────────────────────────────────────────── */

test('round-trips every state field §8.4 names, with no field left behind', () => {
  const state: State = {
    ...INITIAL_STATE,
    city: 'Kano',
    contour: 'L90',
    cluster: String(CLUSTER_IDS[2]),
    year: 2017,
    userPickedBase: true,
  };
  const view: LinkView = { tab: 'report', theme: 'modernist', lang: 'yo', base: 'light', swipe: 0.31 };

  const back = decodeState(encodeState(state, view), VOCAB);

  expect(back).toEqual({
    city: 'Kano',
    contour: 'L90',
    cluster: String(CLUSTER_IDS[2]),
    year: 2017,
    tab: 'report',
    theme: 'modernist',
    lang: 'yo',
    base: 'light',
    swipe: 0.31,
  });
  /* The eight §8.4 fields, and the ONE field §11 rejected. An earlier draft of §8.4 listed
   * "density"; revision 1's density control was rejected and there is nothing to encode. */
  expect(KNOWN_PARAMS).toEqual(['tab', 'city', 'contour', 'cluster', 'year', 'theme', 'lang', 'base', 'swipe']);
  expect(KNOWN_PARAMS).not.toContain('density');
});

test('omits every default, so the URL of a freshly loaded page is just the theme and the language', () => {
  expect(linkSearch(INITIAL_STATE, DEFAULT_VIEW)).toBe('?theme=nocturne&lang=en');
});

test('writes theme and language even at their defaults, because the reader of the memo may have stored others', () => {
  /* Ruling 6 persists both in localStorage. A link that omitted `theme=nocturne` would render in
   * Modernist for anyone whose last choice was Modernist, which defeats the point of §8.4. */
  const q = encodeState(INITIAL_STATE, DEFAULT_VIEW);
  expect(q.get('theme')).toBe('nocturne');
  expect(q.get('lang')).toBe('en');
});

test('writes base only once ruling 7 is latched, because until then the basemap is a function of the theme', () => {
  expect(encodeState(INITIAL_STATE, DEFAULT_VIEW).has('base')).toBe(false);
  const picked = encodeState({ ...INITIAL_STATE, userPickedBase: true }, { ...DEFAULT_VIEW, base: 'light' });
  expect(picked.get('base')).toBe('light');
  /* And the far end latches too, or Shell's theme effect would drag it straight back. That is
   * asserted on the applier in deeplink.sync.test.tsx; here it is enough that the value travels. */
});

test('a city name with diacritics survives the round trip, bytes and all', () => {
  /* No city in cities.json carries one — all 55 names are ASCII, asserted below — so the
   * vocabulary is supplied explicitly. The encoding still has to be right: `Yorùbá` is the
   * language picker's own label, the typology strings carry an en dash and a middle dot, and a
   * future re-cut of the corpus with real Nigerian orthography (Ìbàdàn, Ilọrin) must not need a
   * change here. URLSearchParams percent-encodes as UTF-8 both ways. */
  const names = ['Ìbàdàn', 'Ilọrin', 'Yorùbá City'];
  for (const name of names) {
    const q = encodeState({ ...INITIAL_STATE, city: name }, DEFAULT_VIEW);
    expect(q.toString()).toContain(encodeURIComponent(name).replace(/%20/g, '+'));
    expect(decodeState(q, { cities: names }).city).toBe(name);
  }
  expect(CITY_NAMES.filter((n) => /[^\x20-\x7e]/.test(n))).toEqual([]);
});

test('every one of the 55 real city names round-trips', () => {
  for (const name of CITY_NAMES) {
    expect(decodeState(encodeState({ ...INITIAL_STATE, city: name }, DEFAULT_VIEW), VOCAB).city).toBe(name);
  }
  expect(CITY_NAMES).toHaveLength(55);
});

test('every real cluster id round-trips, and so does the all sentinel', () => {
  for (const id of CLUSTER_IDS) {
    const q = encodeState({ ...INITIAL_STATE, cluster: String(id) }, DEFAULT_VIEW);
    expect(decodeState(q, VOCAB).cluster).toBe(String(id));
  }
  // `all` is the default, so it is omitted rather than written — and decodes to nothing.
  expect(encodeState({ ...INITIAL_STATE, cluster: 'all' }, DEFAULT_VIEW).has('cluster')).toBe(false);
  // But an explicit `?cluster=all` is still honoured: it is a legitimate value, not a default.
  expect(decodeState(p('?cluster=all'), VOCAB).cluster).toBe('all');
});

test('every year the slider offers round-trips', () => {
  for (let y = YEAR_MIN; y <= YEAR_MAX; y += 1) {
    const q = encodeState({ ...INITIAL_STATE, year: y }, DEFAULT_VIEW);
    // 2024 is the default and is omitted; the other nine travel.
    expect(decodeState(q, VOCAB).year ?? INITIAL_STATE.year).toBe(y);
  }
});

/* ── untrusted input ───────────────────────────────────────────────────────────────────────── */

test('ignores an unknown parameter instead of failing on it', () => {
  const back = decodeState(p('?city=Kano&utm_source=memo&density=4&tab=table&=&foo'), VOCAB);
  expect(back).toEqual({ city: 'Kano', tab: 'table' });
  expect(back).not.toHaveProperty('density');
  expect(back).not.toHaveProperty('utm_source');
});

test('rejects an out-of-range year and falls back to the default', () => {
  for (const bad of ['99999', '0', '2014', '2025', '-2019', '2019.5', '2019abc', '', ' 2019', 'NaN', 'Infinity', '2e3']) {
    expect(decodeState(p(`?year=${encodeURIComponent(bad)}`), VOCAB)).not.toHaveProperty('year');
  }
  // The two boundaries are IN range, so the rejection is a range check and not a blanket refusal.
  expect(decodeState(p(`?year=${YEAR_MIN}`), VOCAB).year).toBe(YEAR_MIN);
  expect(decodeState(p(`?year=${YEAR_MAX}`), VOCAB).year).toBe(YEAR_MAX);
  expect(LINK_DEFAULTS.year).toBe(INITIAL_STATE.year);
});

test('rejects an unknown contour level', () => {
  for (const bad of ['L99', 'l50', 'L', 'ALL', '50', '']) {
    expect(decodeState(p(`?contour=${bad}`), VOCAB)).not.toHaveProperty('contour');
  }
  expect(decodeState(p('?contour=L75'), VOCAB).contour).toBe('L75');
  expect(LINK_DEFAULTS.contour).toBe(INITIAL_STATE.contour);
});

test('RULING 39: a link carrying base=plain or base=topo falls back rather than breaking', () => {
  /* These are not hypothetical. Ruling 39 cut the basemap from five Esri providers to two
   * vector grounds, and every link minted before it carries one of the old keys. The valid set
   * is BASE_KEYS, which ruling 39 owns, so this test follows the ruling without an edit here. */
  expect(BASE_KEYS).toEqual(['dark', 'light']);
  for (const stale of ['plain', 'topo', 'gray', 'relief', 'imagery', 'Dark', '']) {
    expect(decodeState(p(`?base=${stale}`), VOCAB)).not.toHaveProperty('base');
  }
  for (const key of BASE_KEYS) {
    expect(decodeState(p(`?base=${key}`), VOCAB).base).toBe(key);
  }
  /* And the fallback is silent: a stale base alongside good parameters loses only itself. */
  expect(decodeState(p('?base=plain&theme=modernist&year=2016'), VOCAB)).toEqual({
    theme: 'modernist',
    year: 2016,
  });
});

test('rejects a city that is not in the data, however plausible it looks', () => {
  for (const bad of ['Springfield', 'KANO', 'kano', 'Kano ', '<script>alert(1)</script>', '']) {
    expect(decodeState(p(`?city=${encodeURIComponent(bad)}`), VOCAB)).not.toHaveProperty('city');
  }
  expect(decodeState(p('?city=Kano'), VOCAB).city).toBe('Kano');
  expect(LINK_DEFAULTS.city).toBe(INITIAL_STATE.city);
});

test('drops city and cluster entirely when there is no vocabulary to check them against', () => {
  /* The data fetch is in flight, or it failed. "Cannot be checked" is treated as "not valid":
   * the alternative is pattern-matching a city name, and `?city=Springfield` looks exactly as
   * plausible as `?city=Ibadan` to a regular expression. */
  const back = decodeState(p('?city=Kano&cluster=4&year=2016'));
  expect(back).toEqual({ year: 2016 });
  // `all` needs no vocabulary: it is the sentinel, not a lookup.
  expect(decodeState(p('?cluster=all')).cluster).toBe('all');
});

test('rejects an unknown cluster', () => {
  // 2, 3 and 5 are real k=25 labels that came out EMPTY; clusters.json holds the 16 occupied.
  expect(CLUSTER_IDS).not.toContain(2);
  for (const bad of ['2', '99', '0', '-1', 'four', '4.0', '']) {
    expect(decodeState(p(`?cluster=${encodeURIComponent(bad)}`), VOCAB)).not.toHaveProperty('cluster');
  }
  expect(decodeState(p('?cluster=4'), VOCAB).cluster).toBe('4');
  expect(LINK_DEFAULTS.cluster).toBe(INITIAL_STATE.cluster);
});

test('rejects an unknown tab, theme or language', () => {
  for (const q of ['?tab=dashboard', '?theme=solarized', '?lang=fr', '?tab=', '?theme=', '?lang=']) {
    expect(decodeState(p(q), VOCAB)).toEqual({});
  }
});

test('rejects a divider position outside the handle travel rather than clamping it', () => {
  /* Clamping would honour `?swipe=99` as "hard right", which is a view the link did not ask for
   * and is indistinguishable from a typo. §8.4 says fall back to the default. */
  for (const bad of ['99', '-0.2', '1', '0', '0.07', '0.93', 'half', '', 'NaN', '1e-1']) {
    expect(decodeState(p(`?swipe=${encodeURIComponent(bad)}`), VOCAB)).not.toHaveProperty('swipe');
  }
  expect(decodeState(p(`?swipe=${SWIPE_MIN}`), VOCAB).swipe).toBe(SWIPE_MIN);
  expect(decodeState(p(`?swipe=${SWIPE_MAX}`), VOCAB).swipe).toBe(SWIPE_MAX);
  expect(LINK_DEFAULTS.swipe).toBe(SWIPE_DEFAULT);
});

test('writes the divider to four decimal places, so a dragged float does not reach a memo raw', () => {
  expect(swipeParam(0.5500000000000001)).toBe('0.55');
  expect(swipeParam(0.31425926)).toBe('0.3143');
  // Four decimals of the fraction is a seventh of a pixel at 1440px wide.
  expect(Math.abs(Number(swipeParam(0.31425926)) - 0.31425926) * 1440).toBeLessThan(0.5);
});

/* ── history ───────────────────────────────────────────────────────────────────────────────── */

test('replaces history rather than pushing on every slider tick', () => {
  /* The year drag is nine change events and the divider drag is dozens. Pushing each one buries
   * the back button, which is the §8.4 failure this rule exists for. */
  expect(CONTINUOUS_PARAMS).toEqual(['year', 'swipe']);
  const base = p('?theme=nocturne&lang=en');
  let prev = base;
  for (const year of [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015]) {
    const next = p(`?theme=nocturne&lang=en&year=${year}`);
    expect(historyMode(prev, next)).toBe('replace');
    prev = next;
  }
  // The divider, the same way, and the two of them moving together.
  expect(historyMode(base, p('?theme=nocturne&lang=en&swipe=0.31'))).toBe('replace');
  expect(historyMode(base, p('?theme=nocturne&lang=en&year=2016&swipe=0.31'))).toBe('replace');
  // And dropping back to the default — the parameter disappearing is still only a year change.
  expect(historyMode(p('?year=2016'), p(''))).toBe('replace');
});

test('pushes history for a decision: a city, a tab, a theme, a level, a cluster, a basemap', () => {
  const base = p('?theme=nocturne&lang=en');
  expect(historyMode(base, p('?theme=nocturne&lang=en&city=Kano'))).toBe('push');
  expect(historyMode(base, p('?theme=nocturne&lang=en&tab=report'))).toBe('push');
  expect(historyMode(base, p('?theme=modernist&lang=en'))).toBe('push');
  expect(historyMode(base, p('?theme=nocturne&lang=en&contour=L90'))).toBe('push');
  expect(historyMode(base, p('?theme=nocturne&lang=en&cluster=4'))).toBe('push');
  expect(historyMode(base, p('?theme=nocturne&lang=en&base=light'))).toBe('push');
  expect(historyMode(base, p('?theme=nocturne&lang=yo'))).toBe('push');
  // A decision taken DURING a drag still pushes: the rule is "only continuous", not "any".
  expect(historyMode(base, p('?theme=nocturne&lang=en&year=2016&city=Kano'))).toBe('push');
});

test('replaces when nothing changed at all, so an idle commit never touches history', () => {
  const same = p('?theme=nocturne&lang=en&year=2016');
  expect(changedParams(same, p('?theme=nocturne&lang=en&year=2016'))).toEqual([]);
  expect(historyMode(same, p('?theme=nocturne&lang=en&year=2016'))).toBe('replace');
  // Parameter ORDER is not a change; `changedParams` compares by name.
  expect(changedParams(same, p('?year=2016&lang=en&theme=nocturne'))).toEqual([]);
});

test('changedParams names an addition, a removal and a value change alike', () => {
  expect(changedParams(p('?a=1'), p('?a=2'))).toEqual(['a']);
  expect(changedParams(p('?a=1'), p('?a=1&b=2'))).toEqual(['b']);
  expect(changedParams(p('?a=1&b=2'), p('?a=1'))).toEqual(['b']);
  expect(changedParams(p('?utm=memo&year=2016'), p('?year=2017'))).toEqual(['utm', 'year']);
});

test('LINK_DEFAULTS is the real default set, so "falls back to the default" means one thing', () => {
  expect(LINK_DEFAULTS).toEqual({
    tab: 'map',
    city: INITIAL_STATE.city,
    contour: INITIAL_STATE.contour,
    cluster: INITIAL_STATE.cluster,
    year: INITIAL_STATE.year,
    theme: 'nocturne',
    lang: 'en',
    swipe: SWIPE_DEFAULT,
  });
});
