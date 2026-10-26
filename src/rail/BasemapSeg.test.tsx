// @vitest-environment jsdom
/* Basemap segment guards - rulings 25 and 7.
 *
 * Both rulings are the kind that a later reader would "clean up" in good faith: five raster
 * basemaps look like three too many, and a latch that is never reset looks like a missing
 * reset. The test names carry the reason.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { BASES, baseButtonLabel } from './BasemapSeg';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('#baseSeg button')];

test('ruling 29 overrides ruling 25: three VECTOR variants, and dark/topo keep their keys', () => {
  /* Ruling 25 froze five Esri raster layers because §3's Changed table does not list a basemap
   * change. §8.3 is approved by the user and overrides it. The `dark` and `topo` KEYS are the
   * part that must not drift: ruling 7's theme effect maps `nocturne -> dark` and
   * `modernist -> topo`, so those two strings are a contract between App and this segment, not
   * labels. See the §8.3 entry in tests/fidelity/allowed-diffs.ts for the sanctioned width. */
  renderApp(<App data={null} />);
  expect(buttons().map((b) => b.dataset.v)).toEqual(['dark', 'light']);
  expect(Object.keys(BASES)).toEqual(['dark', 'light']);
});

test("each label is the SECOND WORD of its config label, so 'Vector Dark' renders as 'Dark'", () => {
  renderApp(<App data={null} />);
  expect(buttons().map((b) => b.textContent)).toEqual(['Dark', 'Light']);
  expect(baseButtonLabel('light')).toBe('Light');
  // Derived from the config at render time, which is why they are not in the dictionary and
  // stay English in all four languages - exactly as the Esri ones did.
  for (const def of Object.values(BASES)) expect(def.label.split(' ')[0]).toBe('Vector');
});

test('every button carries the inline font-size:10.5px the original set on it', () => {
  // This is also the `.seg button` the fidelity guard measures: the basemap group precedes the
  // contour group, so the first `.seg button` in the document is this one.
  renderApp(<App data={null} />);
  expect(buttons().map((b) => b.style.fontSize)).toEqual(Array(2).fill('10.5px'));
  expect(document.querySelector<HTMLElement>('.seg button')!.style.fontSize).toBe('10.5px');
});

test('the active key follows the theme until the reader picks one, and never again (ruling 7)', async () => {
  const user = userEvent.setup();
  const onBasePicked = vi.fn();
  renderApp(<App data={null} onBasePicked={onBasePicked} />);
  const pressed = () => buttons().find((b) => b.getAttribute('aria-pressed') === 'true')!.dataset.v;
  const theme = document.getElementById('theme') as HTMLSelectElement;

  // Nocturne -> dark, and a theme change drags the basemap along while the latch is clear.
  expect(pressed()).toBe('dark');
  await user.selectOptions(theme, 'modernist');
  expect(pressed()).toBe('light');

  /* The reader picks `dark` - deliberately the option this theme would NOT have chosen. With two
   * options (ruling 39) that is what makes the latch provable: if it ever failed, the next theme
   * change would drag the key back to `light` and the assertions below would catch it. Picking
   * the theme's own default would have proved nothing. */
  await user.click(buttons().find((b) => b.dataset.v === 'dark')!);
  expect(pressed()).toBe('dark');
  expect(onBasePicked).toHaveBeenCalledWith('dark');

  /* And it is PERMANENT. Nothing in the original ever clears userPickedBase, so further theme
   * changes - including back to the one that was active when the reader chose - must leave the
   * reader's basemap alone. */
  await user.selectOptions(theme, 'nocturne');
  expect(pressed()).toBe('dark');
  await user.selectOptions(theme, 'modernist');
  expect(pressed()).toBe('dark');
  expect(onBasePicked).toHaveBeenCalledTimes(1);
});
