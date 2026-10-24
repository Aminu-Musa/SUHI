// @vitest-environment jsdom
/* Legend guards - rail group 10.
 *
 * Both tests pin a rule that a plausible future refactor would break:
 *
 *  - The ramp swatches are FILLS, so they keep `--hot-*` / `--cold-*`. "Make the legend match
 *    the KPI figures" would move them to the -ink scale and repaint the key in colours the map
 *    never draws - a key that stops keying anything, which is worse than the contrast problem
 *    the ink scale exists to solve. The ink scale is for ramp colours used as TEXT only.
 *  - Spec §6.3 requires the legend name what the colour means in plain words, not by field
 *    name. "Tidy the legend back to the original's 'SUHI °C'" would undo it.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../app/App';
import { FIXTURE } from './fixtures';
import { COLD_RAMP, COLD_TICKS, HOT_RAMP, HOT_TICKS } from './Legend';
import { ENCODE_DOMAIN } from '../lib/encode.mjs';

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
const mount = () => renderApp(<App data={FIXTURE} />);

const ramps = () => [...document.querySelectorAll<HTMLElement>('.ramp')];
const rampLs = () => [...document.querySelectorAll<HTMLElement>('.rampL')];
const swatches = (r: Element) => [...r.querySelectorAll<HTMLElement>('i')];

describe('the ramps', () => {
  test('hot and cold ramps render all ten FILL tokens, not ink tokens', () => {
    mount();
    expect(ramps().length).toBe(2);
    expect(swatches(ramps()[0]).length).toBe(5);
    expect(swatches(ramps()[1]).length).toBe(5);

    /* The token lists are asserted directly as well as through the DOM: jsdom's CSS parser is
     * unreliable about `background: var(--x)` and silently drops the gradient form entirely
     * (see the note in Kpis.tsx), so a test reading only element.style could pass against ''
     * and prove nothing. */
    expect(HOT_RAMP).toEqual(['--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5']);
    expect(COLD_RAMP).toEqual(['--cold-1', '--cold-2', '--cold-3', '--cold-4', '--cold-5']);
    const all = [...HOT_RAMP, ...COLD_RAMP];
    expect(all.length).toBe(10);
    expect(all.filter((t) => t.endsWith('-ink'))).toEqual([]);

    // And the rendered swatches really carry those tokens, in order, as a background.
    const styles = [...ramps().flatMap((r) => swatches(r))].map((i) => i.getAttribute('style') ?? '');
    expect(styles.length).toBe(10);
    all.forEach((tok, i) => {
      expect(styles[i]).toContain(`var(${tok})`);
      expect(styles[i]).toContain('background');
    });
    expect(styles.some((s) => s.includes('-ink'))).toBe(false);
    expect(styles.some((s) => s.includes('color:'))).toBe(false);
  });

  test('the tick labels use U+2212 MINUS SIGN, not a hyphen', () => {
    /* The original's own markup (prototype line 348). d3-format emits the same character for a
     * negative, so a hyphen here would be visibly narrower than every negative figure in the
     * KPI tiles beside it. */
    mount();
    expect(rampLs().length).toBe(2);
    expect(rampLs()[0].textContent).toBe(HOT_TICKS.join(''));
    expect(rampLs()[1].textContent).toBe(COLD_TICKS.join(''));
    for (const tick of COLD_TICKS) {
      expect(tick.charCodeAt(0)).toBe(0x2212);
      expect(tick).not.toContain('-');
    }
    for (const r of rampLs()) expect(r.querySelectorAll('span').length).toBe(3);
  });

  test('the ticks are spec §6.2`s ±4.5 domain, derived from ENCODE_DOMAIN, not suhii quantiles', () => {
    /* TASK 6 CHANGED THESE. They used to read `+0.0 / +1.8 / +3.7` and `−0.0 / −0.8 / −1.6`,
     * which are quantiles of `suhii` - the variable the rebuild no longer colours by. §6.2 is
     * one continuous diverging scale over `lst_rel` clamped at ±4.5 °C, and the ramp above
     * these numbers is now literally the same expression that fills the polygons, so a legend
     * carrying the old numbers would disagree with its own map. They are DERIVED from
     * ENCODE_DOMAIN rather than typed, so a future domain change cannot leave them behind. */
    expect([...HOT_TICKS]).toEqual(['+0.0', '+2.3', '+4.5']);
    expect([...COLD_TICKS]).toEqual(['−0.0', '−2.3', '−4.5']);
    expect(Math.abs(ENCODE_DOMAIN[1])).toBe(4.5);
    expect(HOT_TICKS[2]).toBe(`+${ENCODE_DOMAIN[1].toFixed(1)}`);
  });
});

describe('spec §6.3 - plain language', () => {
  test('the legend names the encoded variable in plain language', () => {
    mount();
    const heads = [...document.querySelectorAll('.ramp')].map(
      (r) => r.previousElementSibling?.textContent ?? '',
    );
    expect(heads.length).toBe(2);
    expect(heads[0]).toBe('Hot spots — warmer than the rest of this city, °C');
    expect(heads[1]).toBe('Cold spots — cooler than the rest of this city, °C');

    for (const h of heads) {
      expect(h).toContain('than the rest of this city');
      // No jargon: not the field name, not the statistic it is a proxy for, not the old label.
      expect(h).not.toContain('lst_rel');
      expect(h).not.toContain('Gi*');
      expect(h).not.toContain('SUHI');
    }
    expect(heads[0]).toContain('warmer');
    expect(heads[1]).toContain('cooler');
    // The unit survives the rewording: the ticks are °C and would otherwise be bare numbers.
    for (const h of heads) expect(h).toContain('°C');
  });

  test('the legend still carries the original markup the fidelity guard measures', () => {
    /* §6.3 is a CONTENT change. The classes, the nesting and the inline styles are untouched,
     * so `.ramp` and `.rampL` are still compared against the original's boxes. */
    mount();
    for (const r of ramps()) {
      expect(r.className).toBe('ramp');
      expect((r.previousElementSibling as HTMLElement).style.fontSize).toBe('11px');
      expect((r.previousElementSibling as HTMLElement).style.marginBottom).toBe('4px');
      expect(r.nextElementSibling?.className).toBe('rampL');
    }
    expect(document.querySelector('.i18nnote')?.textContent).toContain('first pass');
  });
});
