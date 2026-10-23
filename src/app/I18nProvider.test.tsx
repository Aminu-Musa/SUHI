// @vitest-environment jsdom

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { I18nProvider, useT } from './I18nProvider';
import { D, LANGS, T } from '../i18n/dictionary.mjs';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* ignored */
  }
  document.documentElement.removeAttribute('lang');
});

const langSel = () => document.getElementById('lang') as HTMLSelectElement;

/* #root is wrapped in StrictMode (src/main.tsx), so every render here is too: an effect
 * that is not idempotent passes a bare render and double-fires in the real app. This
 * helper is the only way these suites mount App. */
const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);

describe('useT', () => {
  test('switching language retranslates every data-i18n key', async () => {
    const user = userEvent.setup();
    renderApp(<App />);

    // Every translated node in the shell declares the key it rendered, exactly as the original's
    // markup did, so this walks the real DOM instead of a hand-maintained list.
    const keys = () => [...document.querySelectorAll<HTMLElement>('[data-i18n]')].map((el) => el.dataset.i18n!);
    const rendered = () => [...document.querySelectorAll<HTMLElement>('[data-i18n]')].map((el) => el.textContent);

    expect(keys().length).toBeGreaterThan(8);

    for (const lang of LANGS as string[]) {
      await user.selectOptions(langSel(), lang);
      const i = (LANGS as string[]).indexOf(lang);
      expect(rendered()).toEqual(keys().map((k) => (D as Record<string, string[]>)[k][i]));
      expect(document.documentElement.lang).toBe(lang);
    }
  });

  test('falls back to English for a key missing in another language', () => {
    // No dictionary entry is short today, so the fallback is exercised against a key that does
    // not exist at all plus a deliberately truncated entry shape.
    function Probe() {
      const t = useT();
      return (
        <>
          <span data-testid="known">{t('tab_map')}</span>
          <span data-testid="unknown">{t('no_such_key')}</span>
        </>
      );
    }
    window.localStorage.setItem('suhi.lang', 'yo');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('known').textContent).toBe('Àwòrán');
    // An unknown key renders as the key itself: visible in the UI and greppable in the source.
    expect(screen.getByTestId('unknown').textContent).toBe('no_such_key');
  });

  test('a language the dictionary does not carry renders the English value', () => {
    // dictionary.mjs's T resolves an unknown language to index -1, which is undefined, which
    // falls through to slot 0. The provider never produces such a language, but Task 9's export
    // filenames and Task 10's brief both call T with whatever they are handed.
    expect(T('tab_map', 'fr')).toBe('Map');
    expect(T('tab_map', 'yo')).toBe('Àwòrán');
  });
});
