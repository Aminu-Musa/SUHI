// @vitest-environment jsdom
/* Spec §8.4's WIRING: the entry URL reaching the controls, and the controls reaching the URL.
 * `deeplink.test.ts` owns the pure encoder, decoder and history rule; this suite owns the parts
 * that need a document and a history stack, and it drives the REAL `<App>` rather than the hook
 * in isolation — the ruling 7 interaction between a link's basemap and the theme effect only
 * exists when both are mounted together.
 *
 * Every render is inside `<StrictMode>`, as `src/main.tsx` is. That is not decoration here: the
 * two appliers and the writer are effects, StrictMode invokes every effect twice on mount by
 * design, and an applier that is not idempotent would push a second history entry on boot. Two
 * tests below assert exactly that count.
 *
 * THEME IS SEEDED THROUGH localStorage, NEVER by setting `data-theme`. `ThemeProvider` WRITES
 * that attribute in an effect rather than reading it (Task 9 found this the hard way), so a test
 * that sets it has it overwritten on mount and runs against the default theme while appearing to
 * assert the other one. Every theme assertion below reads the attribute back after mount.
 *
 * `window.history` IS REAL, not stubbed. jsdom implements pushState and replaceState against a
 * real session history, so `location.search` after a commit is the actual outcome rather than
 * what a spy was told. The spies only COUNT the calls, to tell push from replace.
 */

import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { THEME_KEY } from './ThemeProvider';
import { FIXTURE } from '../rail/fixtures';
import { SWIPE_DEFAULT } from '../map/Swipe';

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);

/** Puts a query string on the document before mounting, which is what a deep link IS. */
function enter(search: string): void {
  window.history.replaceState(null, '', search ? `/?${search}` : '/');
}

beforeEach(() => {
  enter('');
  try {
    window.localStorage.clear();
  } catch {
    /* ignored */
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  enter('');
  try {
    window.localStorage.clear();
  } catch {
    /* ignored */
  }
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
});

const byId = (id: string) => document.getElementById(id)!;
const sel = (id: string) => document.getElementById(id) as HTMLSelectElement;
const segPressed = (id: string) =>
  [...byId(id).querySelectorAll('button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
const activeTab = () =>
  document.querySelector('.tab[aria-selected="true"]')?.getAttribute('data-tab');
const briefCityName = () => document.querySelector('#brief h3')?.textContent;
const swipeNow = () => Number(document.querySelector('[role="slider"][aria-valuemin]')?.getAttribute('aria-valuenow'));

/* ── the entry URL reaching the controls ───────────────────────────────────────────────────── */

test('applies all eight §8.4 fields from the entry URL', () => {
  enter('tab=report&city=Kano&contour=L90&cluster=4&year=2017&theme=modernist&lang=yo&base=light&swipe=0.31');
  renderApp(<App data={FIXTURE} />);

  expect(document.documentElement.dataset.theme).toBe('modernist');
  expect(document.documentElement.lang).toBe('yo');
  expect(sel('theme').value).toBe('modernist');
  expect(sel('lang').value).toBe('yo');
  expect(activeTab()).toBe('report');
  expect(segPressed('contourSeg')).toEqual(['L90']);
  expect(sel('cluster').value).toBe('4');
  expect((byId('year') as HTMLInputElement).value).toBe('2017');
  expect(byId('yearVal').textContent).toBe('2017');
  expect(segPressed('baseSeg')).toEqual(['Light']);
  expect(swipeNow()).toBe(31);
  // The city scope is visible in the brief the Reports tab renders, which is the tab we asked for.
  expect(briefCityName()).toBe('Kano');
});

test('RULING 39: base=plain falls back to the theme ground rather than breaking the segment', () => {
  /* Links minted before ruling 39 cut five Esri providers to two vector grounds carry
   * `base=plain`, `base=topo` and three more. The dropped value must leave ruling 7's latch
   * CLEAR, so the basemap goes on following the theme exactly as it would with no base at all —
   * which is the whole difference between falling back and breaking. */
  enter('base=plain&theme=modernist');
  renderApp(<App data={FIXTURE} />);

  expect(document.documentElement.dataset.theme).toBe('modernist');
  expect(segPressed('baseSeg')).toEqual(['Light']);
  // The stale value does not survive into the URL the page writes back.
  expect(new URLSearchParams(window.location.search).has('base')).toBe(false);
});

test('RULING 39: base=topo in Nocturne falls back to the dark ground, and the segment still has exactly one pressed button', () => {
  enter('base=topo');
  renderApp(<App data={FIXTURE} />);
  expect(segPressed('baseSeg')).toEqual(['Dark']);
});

test('a VALID base latches ruling 7, or the theme effect would drag the link back on the first commit', () => {
  /* `?theme=modernist&base=dark` is a legitimate request — a dark basemap under a light UI — and
   * it only survives because the applier goes through Shell's `pickBase`, which sets
   * `userPickedBase`. Without the latch the theme effect would immediately set `light`. */
  enter('theme=modernist&base=dark');
  const onBasePicked = vi.fn();
  renderApp(<App data={FIXTURE} onBasePicked={onBasePicked} />);

  expect(document.documentElement.dataset.theme).toBe('modernist');
  expect(segPressed('baseSeg')).toEqual(['Dark']);
  expect(onBasePicked).toHaveBeenCalledWith('dark');
  // And it travels back out, because the latch is what makes `base` worth writing.
  expect(new URLSearchParams(window.location.search).get('base')).toBe('dark');
});

test('an out-of-range year never reaches the slider', () => {
  enter('year=99999');
  renderApp(<App data={FIXTURE} />);
  expect((byId('year') as HTMLInputElement).value).toBe('2024');
  expect(byId('yearVal').textContent).toBe('2024');
});

test('an unknown contour level never reaches the segment', () => {
  enter('contour=L99');
  renderApp(<App data={FIXTURE} />);
  expect(segPressed('contourSeg')).toEqual(['All 441']);
});

test('a nonexistent city never reaches the map, and the brief falls back to the default', () => {
  enter('tab=report&city=Springfield');
  renderApp(<App data={FIXTURE} />);
  // Prototype line 1133's fallback: the scoped city, or Ibadan.
  expect(briefCityName()).toBe('Ibadan');
  expect(new URLSearchParams(window.location.search).has('city')).toBe(false);
});

test('an unknown cluster never reaches the picker', () => {
  enter('cluster=2');
  renderApp(<App data={FIXTURE} />);
  expect(sel('cluster').value).toBe('all');
});

test('an out-of-range divider position never reaches the handle', () => {
  enter('swipe=99');
  renderApp(<App data={FIXTURE} />);
  expect(swipeNow()).toBe(Math.round(SWIPE_DEFAULT * 100));
});

test('an unknown parameter is ignored rather than fatal, and is dropped from the URL the page writes back', () => {
  enter('utm_source=ministry-memo&density=4&year=2016');
  expect(() => renderApp(<App data={FIXTURE} />)).not.toThrow();
  expect((byId('year') as HTMLInputElement).value).toBe('2016');
  const q = new URLSearchParams(window.location.search);
  expect(q.get('year')).toBe('2016');
  expect(q.has('utm_source')).toBe(false);
  expect(q.has('density')).toBe(false);
});

test('a link still applies its typed half when the data has not landed, so the page never paints in the wrong theme', () => {
  /* Phase 1 of the applier. `city` and `cluster` wait for the vocabularies; theme, language,
   * tab, level, year, basemap and divider do not, because a page that paints in Nocturne and
   * corrects itself to Modernist a second later is a visible flash on every deep link. */
  enter('theme=modernist&year=2016&city=Kano');
  renderApp(<App data={null} />);
  expect(document.documentElement.dataset.theme).toBe('modernist');
  expect((byId('year') as HTMLInputElement).value).toBe('2016');
});

test('a stored theme loses to the link, because the memo decides what the reader sees', () => {
  window.localStorage.setItem(THEME_KEY, 'nocturne');
  enter('theme=modernist');
  renderApp(<App data={FIXTURE} />);
  expect(document.documentElement.dataset.theme).toBe('modernist');
});

/* ── the controls reaching the URL ─────────────────────────────────────────────────────────── */

test('replaces history rather than pushing on every slider tick', async () => {
  renderApp(<App data={FIXTURE} />);
  const push = vi.spyOn(window.history, 'pushState');
  const replace = vi.spyOn(window.history, 'replaceState');

  const year = byId('year') as HTMLInputElement;
  for (const value of ['2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015']) {
    await act(async () => {
      fireEvent.change(year, { target: { value } });
    });
  }

  expect(new URLSearchParams(window.location.search).get('year')).toBe('2015');
  expect(replace).toHaveBeenCalledTimes(9);
  expect(push, 'nine years of drag must not cost nine back presses').not.toHaveBeenCalled();
});

test('replaces history on every divider move too', async () => {
  renderApp(<App data={FIXTURE} />);
  const push = vi.spyOn(window.history, 'pushState');
  const replace = vi.spyOn(window.history, 'replaceState');

  const handle = document.querySelector('[role="slider"][aria-valuemin]') as HTMLElement;
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    });
  }

  expect(replace.mock.calls.length).toBeGreaterThanOrEqual(5);
  expect(push).not.toHaveBeenCalled();
  expect(new URLSearchParams(window.location.search).has('swipe')).toBe(true);
});

test('pushes one history entry for a decision, so the back button returns to the previous view', async () => {
  const user = userEvent.setup();
  renderApp(<App data={FIXTURE} />);
  const push = vi.spyOn(window.history, 'pushState');

  await user.selectOptions(sel('theme'), 'modernist');
  expect(new URLSearchParams(window.location.search).get('theme')).toBe('modernist');
  expect(push).toHaveBeenCalledTimes(1);

  await user.click(document.querySelector('.tab[data-tab="report"]')!);
  expect(new URLSearchParams(window.location.search).get('tab')).toBe('report');
  expect(push).toHaveBeenCalledTimes(2);
});

test('boot NEVER pushes, however much normalising the entry URL needs', () => {
  /* A link carrying `base=plain` and a campaign tag normalises to a different string than it
   * arrived as, and pushing that would put an entry the reader never visited between them and
   * the page they came from.
   *
   * MEASURED: this boot replaces TWICE, and both are correct. The writer effect runs in the
   * same flush as the applier, so it first normalises against the state as mounted (`year`
   * still 2024, the stale `base` and the campaign tag dropped) and then again one commit later
   * once the applied `year=2016` has landed. Neither is a navigation: the count that matters is
   * the push count, which is zero, and the URL the reader is left holding. Asserting an exact
   * replace count here would be asserting React's flush boundaries. */
  enter('utm_source=memo&base=plain&year=2016');
  const push = vi.spyOn(window.history, 'pushState');
  const replace = vi.spyOn(window.history, 'replaceState');

  renderApp(<App data={FIXTURE} />);

  expect(push, 'a boot must leave the back button one press from where the reader came in').not.toHaveBeenCalled();
  expect(replace.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(window.location.search).toBe('?year=2016&theme=nocturne&lang=en');
});

test('an idle commit writes nothing at all, so the writer cannot loop', () => {
  enter('theme=nocturne&lang=en');
  const push = vi.spyOn(window.history, 'pushState');
  const replace = vi.spyOn(window.history, 'replaceState');
  renderApp(<App data={FIXTURE} />);
  // The entry URL already IS what the page would write, so neither is touched - under
  // StrictMode's double mount as well.
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(window.location.search).toBe('?theme=nocturne&lang=en');
});

test('the back button restores the previous view rather than only the address bar', async () => {
  /* Pushing entries that change the URL and nothing else is a worse back button than none: it
   * looks as though it worked. The popstate listener is what makes the pushes mean something. */
  const user = userEvent.setup();
  renderApp(<App data={FIXTURE} />);

  await user.selectOptions(sel('theme'), 'modernist');
  expect(document.documentElement.dataset.theme).toBe('modernist');

  /* jsdom traverses the session history on a QUEUED task, so both `location` and the popstate
   * event land some time after the call returns - a single macrotask is not reliably enough,
   * which is how this test first failed while the behaviour was correct. Polled instead. */
  await act(async () => {
    window.history.back();
  });
  await waitFor(() => expect(window.location.search).toBe('?theme=nocturne&lang=en'));
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('nocturne'));
  // And the writer does not fight the traversal back the other way.
  expect(window.location.search).toBe('?theme=nocturne&lang=en');
});

test('a full round trip: a link, a change, and the link the page hands back', async () => {
  const user = userEvent.setup();
  enter('tab=report&city=Kano&contour=L90&year=2017&theme=modernist&lang=en&swipe=0.31');
  renderApp(<App data={FIXTURE} />);

  expect(briefCityName()).toBe('Kano');
  await user.selectOptions(sel('cluster'), '4');

  const q = new URLSearchParams(window.location.search);
  expect(Object.fromEntries(q)).toEqual({
    tab: 'report',
    city: 'Kano',
    contour: 'L90',
    cluster: '4',
    year: '2017',
    theme: 'modernist',
    lang: 'en',
    swipe: '0.31',
  });
});
