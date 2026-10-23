// @vitest-environment jsdom
/* Search guards (ruling 23).
 *
 * The rule under test is deliberately dumber than the placeholder promises, so the test NAMES
 * carry the reason - deleting one means arguing with the name.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { FIXTURE } from './fixtures';
import { matchCities } from './Search';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

const DATA = FIXTURE;

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const mount = () => renderApp(<App data={DATA} />);
const input = () => document.getElementById('search') as HTMLInputElement;
const rows = () => [...document.querySelectorAll<HTMLElement>('#results .rw')];

test('renders the original search box and an always-present, initially empty results list', () => {
  mount();
  expect(input().className).toBe('search');
  expect(input().placeholder).toBe('Search city or spot ID…');
  expect(input().getAttribute('autocomplete')).toBe('off');
  const results = document.getElementById('results')!;
  expect(results.className).toBe('rowlist');
  expect(results.style.marginTop).toBe('6px');
  expect(results.childElementCount).toBe(0);
});

test('matches a city by a case-insensitive substring of its name', async () => {
  const user = userEvent.setup();
  mount();
  await user.type(input(), 'kan');
  const labels = rows().map((r) => r.dataset.c);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels).toContain('Kano');
  for (const name of labels) expect(name!.toLowerCase()).toContain('kan');
  // Each row carries the city's SUHI with a leading '+', whatever the sign - the original's
  // own template, not a formatter.
  const kano = DATA.cities.find((c) => c.city === 'Kano')!;
  const row = rows().find((r) => r.dataset.c === 'Kano')!;
  expect(row.querySelector('.n')!.textContent).toBe(`+${kano.suhii}°`);
  expect(row.querySelector('span')!.textContent).toBe('Kano');
});

test('caps results at six and shows an em dash when nothing matches', async () => {
  const user = userEvent.setup();
  mount();
  // 'a' appears in far more than six of the 55 names.
  expect(DATA.cities.filter((c) => c.city.toLowerCase().includes('a')).length).toBeGreaterThan(6);
  await user.type(input(), 'a');
  expect(rows().length).toBe(6);

  await user.clear(input());
  await user.type(input(), 'zzzz');
  expect(rows().length).toBe(0);
  const note = document.querySelector<HTMLElement>('#results .note')!;
  expect(note.textContent).toBe('—');
  // The padding is inline in the original, not a CSS rule, and `.note` has none of its own.
  expect(note.style.padding).toBe('4px 7px');

  // An emptied box empties the list rather than showing the em dash for a blank query.
  await user.clear(input());
  expect(document.getElementById('results')!.childElementCount).toBe(0);
});

test('ruling 23: spot IDs are NOT searchable, although the placeholder says they are', () => {
  /* The original's handler filtered CITIES only (prototype line 999) while its placeholder
   * read "Search city or spot ID…". Adding spot IDs would change what the reader can find,
   * which is a feature, not a transcription - so the copy stays wrong and the behaviour stays
   * faithful. */
  const spotId = DATA.spots.features[0].properties.spot_id;
  expect(spotId).toMatch(/^[a-z]/);
  expect(matchCities(DATA.cities, spotId)).toEqual([]);
  expect(matchCities(DATA.cities, 'aba_dc_T2_001')).toEqual([]);
});

test('ruling 23: the match does not fold diacritics, and every one of the 55 city names is ASCII', () => {
  /* Folding would be an improvement with no evidence behind it: there is no city name in the
   * shipped data that folding could help anyone find. The second assertion is what keeps that
   * claim true - if a non-ASCII name is ever added, this test fails and the decision gets
   * revisited rather than silently becoming wrong. */
  expect(DATA.cities.length).toBe(55);
  expect(DATA.cities.filter((c) => !/^[\x20-\x7e]+$/.test(c.city))).toEqual([]);
  // The rule really is a plain substring on the lowercased name: an accented query matches
  // nothing rather than its unaccented counterpart.
  expect(matchCities(DATA.cities, 'Ìbàdàn')).toEqual([]);
  expect(matchCities(DATA.cities, 'ibadan').map((c) => c.city)).toEqual(['Ibadan']);
});

test('picking a row scopes the dashboard to that city and clears the box', async () => {
  const user = userEvent.setup();
  mount();
  await user.type(input(), 'lago');
  await user.click(rows().find((r) => r.dataset.c === 'Lagos')!);
  expect(input().value).toBe('');
  expect(document.getElementById('results')!.childElementCount).toBe(0);
  expect(document.getElementById('scopeLabel')!.textContent).toBe('Lagos · scoped');
});
