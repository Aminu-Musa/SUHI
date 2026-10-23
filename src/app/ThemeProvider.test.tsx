// @vitest-environment jsdom

/* Theme behaviours that App.test.tsx does NOT already cover.
 *
 * App.test.tsx owns the shell-level cases: reload persistence, a stored value outside the
 * allowed set, a throwing localStorage at BOOT, and both sides of the ruling 7 basemap latch.
 * Those are not repeated here - a duplicated test costs maintenance and adds no signal, and
 * when one of them changes you want exactly one place to change it.
 *
 * What is left are three gaps, each about a moment the shell tests do not reach: the attribute
 * flip itself, the write path on a theme CHANGE rather than at boot, and the deliberate
 * decision not to persist on mount. */

import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { DEFAULT_THEME, THEME_KEY } from './ThemeProvider';

const themeSel = () => document.getElementById('theme') as HTMLSelectElement;

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* ignored */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    /* ignored */
  }
  document.documentElement.removeAttribute('data-theme');
});

/* #root is wrapped in StrictMode (src/main.tsx), so every render here is too: an effect
 * that is not idempotent passes a bare render and double-fires in the real app. This
 * helper is the only way these suites mount App. */
const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);

test('flips data-theme on the document and nothing else, because every themed value is a custom property under html[data-theme]', async () => {
  const user = userEvent.setup();
  renderApp(<App />);

  expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
  await user.selectOptions(themeSel(), 'modernist');
  expect(document.documentElement.dataset.theme).toBe('modernist');
  await user.selectOptions(themeSel(), 'nocturne');
  expect(document.documentElement.dataset.theme).toBe('nocturne');
});

test('does not persist on mount, so a boot never writes the default over a value it did not put there', () => {
  renderApp(<App />);
  // ThemeProvider persists only while paintEpoch > 0. Writing on mount would clobber whatever
  // a future version had stored under this key before this provider learned to read it.
  expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
});

test('a theme change still applies when the WRITE throws, not only when the read does', async () => {
  const user = userEvent.setup();
  renderApp(<App />);

  // Boot succeeded, so this covers the other half of ruling 6: storage that accepts a read and
  // refuses a write, which is what a quota-exceeded or read-only store actually does.
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem() {
      throw new DOMException('quota', 'QuotaExceededError');
    },
    clear: () => {},
  });

  await user.selectOptions(themeSel(), 'modernist');
  expect(document.documentElement.dataset.theme).toBe('modernist');
});
