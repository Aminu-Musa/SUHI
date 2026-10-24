// @vitest-environment jsdom
/* `#zoomHint` - ruling 9's on-screen disclosure, which is the reason the geometry exaggeration
 * is a design decision and not a hack to delete.
 *
 * Renders inside <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { I18nProvider } from '../app/I18nProvider';
import { ZoomHint } from './ZoomHint';
import { EXAG } from './exaggerate';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

const show = (factor: number) =>
  render(
    <StrictMode>
      <I18nProvider>
        <ZoomHint factor={factor} />
      </I18nProvider>
    </StrictMode>,
  );

const hint = () => document.getElementById('zoomHint') as HTMLElement;

test('the factor is shown with a MULTIPLICATION SIGN (U+00D7), not the letter x', () => {
  /* Prototype line 741 substituted `'×' + k` into `hint_zoom`'s `{k}` placeholder. The two
   * characters are indistinguishable in most editors, so the only way this stays right is a
   * test that asserts the code point. */
  show(9);
  expect(hint().textContent).toContain('×9');
  expect(hint().textContent).not.toContain('x9');
  expect(hint().textContent).not.toContain('{k}');
});

test('factor 1 switches to the true-extent string, not "scaled x1"', () => {
  // `on = factor > 1`, so the hint never claims a distortion that is not happening.
  show(1);
  expect(hint().textContent).toBe('Showing true polygon extent at map scale.');
  expect(hint().textContent).not.toContain('×');
});

test('the colour is accent while exaggerating and --ui-muted once it is not (line 742)', () => {
  show(6);
  expect(hint().style.color).toBe('var(--color-accent)');
  cleanup();
  show(1);
  expect(hint().style.color).toBe('var(--ui-muted)');
});

test('it is a `.mapsub` with the original`s id, because .ovl and .mapsub are measured selectors', () => {
  // Task 6 deleted `.ovl` and `.mapsub` from CONTENT_PENDING, which it could only do because
  // this element now has text. Changing the class or the id would un-measure both.
  show(4);
  expect(hint().className).toBe('mapsub');
  expect(hint().tagName).toBe('P');
});

test('every factor the map can produce has a hint, including the 2.2 bucket', () => {
  for (const k of [...Object.values(EXAG), 1]) {
    cleanup();
    show(k);
    const text = hint().textContent ?? '';
    expect(text.length).toBeGreaterThan(20);
    if (k > 1) expect(text).toContain(`×${k}`);
  }
});
