// @vitest-environment jsdom
/* Shell guards. Several of these pin behaviour that reads as a bug until you know why, so each
 * such test's NAME carries the reason - a future reader deleting it has to argue with the name.
 *
 * Interaction goes through user-event, not fireEvent.click: Radix's Tabs.Trigger activates on
 * MOUSEDOWN, so a bare click() event never changes the tab and these tests would pass against a
 * shell that does nothing. */

import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { type ThemeBaseKey } from './App';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
});

const display = (el: Element) => window.getComputedStyle(el).display;
const tabButtons = () => screen.getAllByRole('tab');
const sel = (id: string) => document.getElementById(id) as HTMLSelectElement;
const byId = (id: string) => document.getElementById(id)!;

/* #root is wrapped in StrictMode (src/main.tsx), so every render here is too: an effect
 * that is not idempotent passes a bare render and double-fires in the real app. This
 * helper is the only way these suites mount App. */
const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);

describe('header', () => {
  test('renders the four tabs in the original order', () => {
    renderApp(<App />);
    expect(tabButtons().map((b) => b.getAttribute('data-tab'))).toEqual(['map', 'compare', 'table', 'report']);
    expect(tabButtons().map((b) => b.textContent)).toEqual(['Map', 'Compare cities', 'Data table', 'Reports']);
    // The original's classes are what the Task 3 fidelity guard selects on.
    expect(tabButtons().every((b) => b.classList.contains('tab'))).toBe(true);
    expect(tabButtons()[0].getAttribute('aria-selected')).toBe('true');
  });

  test('renders brand, language select, theme select, Framed toggle, Export button', () => {
    renderApp(<App />);
    const brand = document.querySelector('.brand');
    expect(brand?.querySelector('b')?.textContent).toBe('SUHI Nigeria');
    expect(brand?.querySelector('span')?.textContent).toBe('2024 composite');

    expect(sel('lang').classList.contains('mini-sel')).toBe(true);
    expect([...sel('lang').options].map((o) => o.value)).toEqual(['en', 'ha', 'ig', 'yo']);
    expect(sel('theme').classList.contains('mini-sel')).toBe(true);
    expect([...sel('theme').options].map((o) => o.value)).toEqual(['nocturne', 'modernist']);

    expect(byId('frameToggle').className).toBe('ghost');
    expect(byId('frameToggle').getAttribute('aria-pressed')).toBe('false');
    expect(byId('frameToggle').textContent).toBe('Framed');

    expect(byId('exportBtn').className).toBe('ghost');
    expect(byId('exportBtn').textContent).toBe('Export');
  });
});

describe('tab switching', () => {
  test('only the selected tab panel has data-on=true', async () => {
    const user = userEvent.setup();
    renderApp(<App />);
    const on = () => ['compare', 'table', 'report'].map((p) => byId('panel-' + p).getAttribute('data-on'));

    expect(on()).toEqual(['false', 'false', 'false']); // Map is selected; no panel is on
    await user.click(tabButtons()[1]);
    expect(on()).toEqual(['true', 'false', 'false']);
    await user.click(tabButtons()[2]);
    expect(on()).toEqual(['false', 'true', 'false']);
    await user.click(tabButtons()[3]);
    expect(on()).toEqual(['false', 'false', 'true']);
  });

  test('the rail and stage stay mounted but are hidden off the Map tab, because the map viewport and the rail filters must survive a tab change while a 332px rail must not share a row with a full-width panel (ruling 5)', async () => {
    const user = userEvent.setup();
    renderApp(<App />);
    expect(display(byId('rail'))).not.toBe('none');
    expect(display(byId('stage'))).not.toBe('none');

    await user.click(tabButtons()[1]);
    // Still in the DOM - presence is NOT what this guards...
    expect(document.getElementById('rail')).not.toBeNull();
    expect(document.getElementById('stage')).not.toBeNull();
    // ...computed display is.
    expect(display(byId('rail'))).toBe('none');
    expect(display(byId('stage'))).toBe('none');

    await user.click(tabButtons()[2]);
    expect(display(byId('rail'))).toBe('none');
    await user.click(tabButtons()[3]);
    expect(display(byId('rail'))).toBe('none');

    await user.click(tabButtons()[0]);
    expect(display(byId('rail'))).not.toBe('none');
    expect(display(byId('stage'))).not.toBe('none');
  });

  test('Export jumps to the report tab, as the original exportBtn did', async () => {
    const user = userEvent.setup();
    renderApp(<App />);
    await user.click(byId('exportBtn'));
    expect(byId('panel-report').getAttribute('data-on')).toBe('true');
    expect(tabButtons()[3].getAttribute('aria-selected')).toBe('true');
  });
});

describe('framed', () => {
  test('Framed toggle adds the .framed class the original toggles, which is what app.css keys on', async () => {
    const user = userEvent.setup();
    renderApp(<App />);

    expect(byId('stage').classList.contains('framed')).toBe(false);
    await user.click(byId('frameToggle'));
    expect(byId('stage').classList.contains('framed')).toBe(true);
    expect(byId('frameToggle').getAttribute('aria-pressed')).toBe('true');

    await user.click(byId('frameToggle'));
    expect(byId('stage').classList.contains('framed')).toBe(false);
    expect(byId('frameToggle').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('persistence (ruling 6)', () => {
  test('theme and language survive a reload via localStorage', async () => {
    const user = userEvent.setup();
    renderApp(<App />);
    await user.selectOptions(sel('theme'), 'modernist');
    await user.selectOptions(sel('lang'), 'ha');

    expect(window.localStorage.getItem('suhi.theme')).toBe('modernist');
    expect(window.localStorage.getItem('suhi.lang')).toBe('ha');

    cleanup(); // the "reload": a fresh mount reading the same storage
    renderApp(<App />);
    expect(sel('theme').value).toBe('modernist');
    expect(sel('lang').value).toBe('ha');
    expect(document.documentElement.dataset.theme).toBe('modernist');
    expect(document.documentElement.lang).toBe('ha');
    expect(tabButtons()[0].textContent).toBe('Taswira'); // Hausa, so the dictionary really switched
  });

  test('a stored value outside the allowed set is ignored rather than written onto the document', () => {
    window.localStorage.setItem('suhi.theme', 'solarized');
    window.localStorage.setItem('suhi.lang', 'fr');
    renderApp(<App />);
    expect(document.documentElement.dataset.theme).toBe('nocturne');
    expect(document.documentElement.lang).toBe('en');
  });

  test('a throwing localStorage falls back to the defaults rather than failing to boot, because the ACCESSOR itself throws in a private window or with site data blocked - not the getItem call', async () => {
    const user = userEvent.setup();
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(() => renderApp(<App />)).not.toThrow();
      expect(document.documentElement.dataset.theme).toBe('nocturne');
      expect(document.documentElement.lang).toBe('en');
      // A write must be swallowed too, or the first theme change takes the app down.
      await user.selectOptions(sel('theme'), 'modernist');
      expect(document.documentElement.dataset.theme).toBe('modernist');
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real);
    }
  });
});

describe('theme drags the basemap (ruling 7)', () => {
  let moves: ThemeBaseKey[];
  let onBaseFromTheme: (key: ThemeBaseKey) => void;

  beforeEach(() => {
    moves = [];
    // One stable identity for the whole test: the callback is an effect dependency.
    onBaseFromTheme = vi.fn((key: ThemeBaseKey) => void moves.push(key));
  });

  test('changing theme moves the basemap while userPickedBase is false', async () => {
    const user = userEvent.setup();
    renderApp(<App onBaseFromTheme={onBaseFromTheme} />);
    expect(moves).toEqual(['dark']); // boot, matching the original's baseKey = 'dark'

    await user.selectOptions(sel('theme'), 'modernist');
    expect(moves).toEqual(['dark', 'light']);

    await user.selectOptions(sel('theme'), 'nocturne');
    expect(moves).toEqual(['dark', 'light', 'dark']);
  });

  test('changing theme leaves the basemap alone once userPickedBase is true, and the latch is never reset', async () => {
    const user = userEvent.setup();
    renderApp(<App initialState={{ userPickedBase: true }} onBaseFromTheme={onBaseFromTheme} />);
    expect(moves).toEqual([]);

    await user.selectOptions(sel('theme'), 'modernist');
    expect(moves).toEqual([]);
    await user.selectOptions(sel('theme'), 'nocturne');
    expect(moves).toEqual([]);
  });
});

/* ══ TASK 12: MAPLIBRE IS LOADED ON DEMAND ══
 *
 * Measured before the change: MapLibre and its tile worker were 426 kB + 145 kB gzipped out of a
 * 426 kB main bundle, statically imported here, and paid for by every reader including one who
 * opened the Data table from a deep link and never looked at the map. These four tests are what
 * stop a future `import { MapStage }` putting it back silently - the bundle would grow and
 * nothing else in the suite would notice.
 */
describe('MapLibre is loaded on demand (task 12)', () => {
  test('App.tsx reaches MapStage through a dynamic import, never a static one', async () => {
    const src = (await import('./App.tsx?raw')).default;
    expect(src.length, '?raw returned nothing, so this test read no source at all').toBeGreaterThan(2000);
    /* The static form is the regression. A bare `from '../map/MapStage'` - with or without a
     * `type` modifier on the same line - puts maplibre-gl back in the entry chunk. */
    expect(src).not.toMatch(/^\s*import\s+\{[^}]*MapStage[^}]*\}\s+from/m);
    expect(src).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\.\/map\/MapStage'\)/);
  });

  test('the map container renders on the default tab, so the common path is unchanged', async () => {
    /* NOT asserted as "absent in the first commit": once React.lazy's payload has resolved - and
     * every earlier test in this file renders <App/> on the Map tab, so it has - React renders
     * the component in the SAME pass, and the assertion would be testing module-load order
     * rather than behaviour. The dynamic import is proved by the source test above and by the
     * two deep-link tests below; what matters here is that the default tab still gets its map. */
    renderApp(<App />);
    await waitFor(() => expect(document.getElementById('map')).toBeTruthy());
  });

  test('a ?tab=table deep link never asks for the map chunk at all', async () => {
    /* The latch is seeded from the URL rather than from `tab`, because `useDeepLink` applies
     * `?tab=` in an effect and the first render of this link still has tab === 'map'. A latch
     * reading `tab` would have been true before the link ever landed, which is the difference
     * between saving the download and only appearing to. */
    window.history.replaceState(null, '', '/?tab=table');
    renderApp(<App />);
    await waitFor(() => expect(byId('panel-table').dataset.on).toBe('true'));
    expect(document.getElementById('map')).toBeNull();
  });

  test('ruling 5 survives: the map mounts on a visit to the Map tab and stays mounted after', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?tab=table');
    renderApp(<App />);
    await waitFor(() => expect(byId('panel-table').dataset.on).toBe('true'));
    expect(document.getElementById('map')).toBeNull();

    await user.click(tabButtons()[0]);
    await waitFor(() => expect(document.getElementById('map')).toBeTruthy());

    // Back to the table: ruling 5 hides the stage with display:none and keeps the map alive.
    await user.click(tabButtons()[2]);
    expect(document.getElementById('map')).toBeTruthy();
    expect(display(byId('stage'))).toBe('none');
  });
});
