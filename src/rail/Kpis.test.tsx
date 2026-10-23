// @vitest-environment jsdom
/* KPI tile and confidence-bar guards.
 *
 * Several of these pin behaviour that reads as a bug until you know why, so each such test's
 * NAME carries the reason: a future reader deleting it has to argue with the name first.
 *
 * The fixtures are the REAL data files, not hand-written ones. The load-bearing test here is
 * the zero-spot case, and it only means anything if the filter combination it uses genuinely
 * selects nothing out of the 441 shipped features - a synthetic fixture could be made to say
 * whatever the test wanted.
 *
 * Every render goes through <StrictMode>, the way src/main.tsx does (standing rule from Task 2:
 * an effect that is not idempotent passes a bare render and double-fires in the real app).
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { FIXTURE } from './fixtures';
import { SHARE_BAR_FILL } from './Kpis';
import { fmt, kpiStats } from './stats';
import { INITIAL_STATE } from '../app/state';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

const DATA = FIXTURE;

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const mount = (initialState = {}) => renderApp(<App data={DATA} initialState={initialState} />);

const tiles = () => [...document.querySelectorAll<HTMLElement>('.kpi')];
const text = (el: Element | null) => el?.textContent ?? '';
const q = (sel: string) => document.querySelector<HTMLElement>(sel);

describe('the six tiles', () => {
  test('renders the original six tiles with .lab, .val and .sub', () => {
    mount();
    const six = tiles();
    expect(six.length).toBe(6);
    expect(six.map((t) => t.className)).toEqual([
      'kpi hot',
      'kpi cold',
      'kpi wide',
      'kpi hot',
      'kpi cold',
      'kpi wide',
    ]);
    expect(six.map((t) => text(t.querySelector('.lab')))).toEqual([
      'Hot spots',
      'Cold spots',
      'Share of studied area',
      'Population inside hot spots',
      'Population inside cold spots',
      'Typology & confidence',
    ]);
    /* The grammar is .lab + .val + a third part, and EVERY tile has it - including the sixth,
     * which in the original had only a .lab and a .sub (spec §9.1 bug 7). The share tile's
     * third part is its `.bar`, not a `.sub`; it never had one, and giving it one would be an
     * addition rather than a correction. */
    for (const t of six) {
      const lab = text(t.querySelector('.lab'));
      expect(t.querySelector('.lab'), `${lab} .lab`).not.toBeNull();
      expect(t.querySelector('.val'), `${lab} .val`).not.toBeNull();
      expect(t.querySelector('.sub, .bar'), `${lab} .sub or .bar`).not.toBeNull();
    }
    expect(six[2].querySelector('.sub')).toBeNull();
    expect(six[2].querySelector('.bar')).not.toBeNull();
    expect(six.filter((t) => t.querySelector('.sub')).length).toBe(5);
    // The figures are the national totals over L50 day+night spots.
    const s = kpiStats(DATA.spots, DATA.cities, INITIAL_STATE);
    expect(text(six[0].querySelector('.val'))).toBe(String(s.hot.length));
    expect(text(six[1].querySelector('.val'))).toBe(String(s.cold.length));
    expect(text(six[0].querySelector('.sub'))).toBe(`${fmt(s.ah, 0)} km²`);
  });

  test('the ramp-coloured KPI figures carry no inline colour, so app.css can map them to the ink scale', () => {
    /* Ruling: a ramp colour used as TEXT must resolve to its -ink token. app.css already maps
     * `.kpi.hot .val` / `.kpi.cold .val` to --hot-4-ink / --cold-4-ink, so the ONLY way those
     * four tiles can be wrong is an inline colour overriding the sheet. The share tile is the
     * one place the original coloured text inline, and those two spans must name -ink tokens. */
    mount();
    const six = tiles();
    for (const i of [0, 1, 3, 4]) {
      expect(six[i].querySelector<HTMLElement>('.val')!.style.color, `tile ${i}`).toBe('');
    }
    const spans = [...six[2].querySelectorAll<HTMLElement>('.val span')].map((s) => s.style.color);
    expect(spans).toEqual([
      'var(--hot-4-ink)',
      'var(--ui-muted)',
      'var(--cold-4-ink)',
      'var(--ui-muted)',
    ]);
    /* The bar beneath is a FILL, so it keeps the PLAIN ramp tokens. Asserted against the
     * exported constants rather than element.style, because jsdom's CSS parser discards
     * `linear-gradient(...,var(--x),var(--y))` entirely - attribute included - so a test
     * reading the DOM here would pass against an empty string and prove nothing. */
    expect(SHARE_BAR_FILL.hot).toBe('linear-gradient(90deg,var(--hot-2),var(--hot-5))');
    expect(SHARE_BAR_FILL.cold).toBe('linear-gradient(90deg,var(--cold-4),var(--cold-2))');
    expect(SHARE_BAR_FILL.hot + SHARE_BAR_FILL.cold).not.toContain('-ink');
  });

  test('ruling 8: the figures are NOT uniformly 24px - the share tile overrides to 19px and both population tiles to 20px', () => {
    /* app.css sets .kpi .val{font-size:24px}; three tiles override it inline and those
     * overrides are the reason the ink scale exists (19px and 20px at weight 500 are body
     * text under WCAG 2.1, so the 3:1 large-text allowance does not apply). Normalising them
     * to 24px would be an improvement, which this rebuild does not make. */
    mount();
    const six = tiles();
    expect(six.map((t) => t.querySelector<HTMLElement>('.val')!.style.fontSize)).toEqual([
      '', // tile 1: inherits 24px from app.css
      '', // tile 2: inherits 24px
      '19px', // share
      '20px', // population in hot
      '20px', // population in cold
      '', // typology: the bug-7 .val takes no inline override either
    ]);
  });

  test('spec §9.1 bug 5: the share bar width IS the share, not Math.min(50, pct*6)', () => {
    mount();
    const s = kpiStats(DATA.spots, DATA.cities, INITIAL_STATE);
    const widths = [...q('.kpi.wide .bar')!.querySelectorAll<HTMLElement>('i')].map((i) => i.style.width);
    expect(widths).toEqual([`${s.pctHot}%`, `${s.pctCold}%`]);
    /* And the original's formula is genuinely gone. At the national scope pctHot is ~1.1%, so
     * the old `Math.min(50, pctHot*6)` would have been ~6.7% - six times too wide, and clamped
     * flat at 50% for anything above 8.33%. */
    expect(widths[0]).not.toBe(`${Math.min(50, s.pctHot * 6)}%`);
    expect(Number.parseFloat(widths[0])).toBeCloseTo(s.pctHot, 10);
  });

  test('scope label and reset reflect the selected city', async () => {
    const user = userEvent.setup();
    const { unmount } = mount();
    expect(text(q('#scopeLabel'))).toBe('National · 55 cities');
    expect(q('#scopeReset')!.style.display).toBe('none');
    unmount();

    mount({ city: 'Lagos' });
    expect(text(q('#scopeLabel'))).toBe('Lagos · scoped');
    expect(q('#scopeReset')!.style.display).toBe('');
    // The tiles are scoped too: Lagos has fewer hot spots than the nation.
    const lagos = kpiStats(DATA.spots, DATA.cities, { ...INITIAL_STATE, city: 'Lagos' });
    const national = kpiStats(DATA.spots, DATA.cities, INITIAL_STATE);
    expect(lagos.hot.length).toBeLessThan(national.hot.length);
    expect(text(tiles()[0].querySelector('.val'))).toBe(String(lagos.hot.length));

    await user.click(q('#scopeReset')!);
    expect(text(q('#scopeLabel'))).toBe('National · 55 cities');
    expect(text(tiles()[0].querySelector('.val'))).toBe(String(national.hot.length));
  });
});

describe('the empty filter', () => {
  /* Review Focus 5. renderKPIs divides by cityArea and by the tallest confidence bin, and
   * d3.mean of an empty array is undefined - so an over-narrow filter is the one combination
   * that can put NaN, Infinity or "undefined" in front of a reader. Lagos' L50 spots are all
   * in cluster 13, so Lagos + cluster 1 really selects nothing out of the 441 features. */
  const EMPTY = { city: 'Lagos', cluster: '1' };

  test('the filter this suite uses really does select zero spots out of the shipped 441', () => {
    // Without this, every assertion below could be passing against a non-empty set.
    expect(DATA.spots.features.length).toBe(441);
    const s = kpiStats(DATA.spots, DATA.cities, { ...INITIAL_STATE, ...EMPTY });
    expect(s.feats.length).toBe(0);
    expect(s.hot.length).toBe(0);
    expect(s.cold.length).toBe(0);
    expect(s.meanS).toBeUndefined();
    // And the denominators that could have been zero are not: this is a real empty NUMERATOR.
    expect(s.cityArea).toBeGreaterThan(0);
  });

  test('a filter selecting zero spots renders an em dash, not NaN', () => {
    mount(EMPTY);
    const six = tiles();

    /* The em dash comes from `fmt`, which is the only guard: d3.mean([]) is undefined, and
     * `undefined` reaches the screen as the string "undefined" without it. */
    expect(text(six[5].querySelector('.val'))).toBe('— °C');

    /* The counted and summed figures are a faithful ZERO, not an em dash: d3.sum([]) is 0 and
     * `[].length` is 0, so the original renders "0" here and so do we. Turning those into em
     * dashes would be an improvement this rebuild does not make - which is why the brief's
     * phrase "every figure renders —" could not be taken literally. */
    expect(text(six[0].querySelector('.val'))).toBe('0');
    expect(text(six[1].querySelector('.val'))).toBe('0');
    expect(text(six[3].querySelector('.val'))).toBe('0');
    expect(text(six[4].querySelector('.val'))).toBe('0');
    expect(text(six[2].querySelector('.val'))).toBe('0.00% hot · 0.00% cold');
    expect(text(six[0].querySelector('.sub'))).toBe('0 km²');

    // The two bars and the four confidence tracks: `0/max` with max||1, so 0%, never NaN%.
    for (const i of document.querySelectorAll<HTMLElement>('.kpi.wide .bar i, .cbar .track i')) {
      expect(i.style.width).toBe('0%');
    }
    expect([...document.querySelectorAll('.cbar .v')].map(text)).toEqual(['0', '0', '0', '0']);
    expect(text(q('#conf .note'))).toBe('0 / 0 — BH');

    /* The invariant, over everything the reader can see AND everything the browser is asked to
     * lay out. A single arithmetic slip anywhere in the rail trips this. */
    const rendered = q('#rail')!;
    for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) {
      expect(rendered.textContent, `rendered text contains ${bad}`).not.toContain(bad);
      expect(rendered.innerHTML, `markup contains ${bad}`).not.toContain(bad);
    }
  });

  test('fmt maps null AND undefined to the em dash, because d3.mean returns undefined', () => {
    expect(fmt(undefined)).toBe('—');
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined, 2)).toBe('—');
    expect(fmt(0)).toBe('0');
    // d3-format, not toFixed: a negative figure carries U+2212, not a hyphen.
    expect(fmt(-1234.567, 2)).toBe('−1,234.57');
  });
});

describe('the confidence bars', () => {
  test('renders four p-value bins sharing the KPI tiles own filtered set', () => {
    mount();
    /* SCOPED TO #conf. Task 5's cluster card renders five more `.cbar` rows in the same rail
     * (the top-five typologies), so an unscoped `.cbar` query picks up nine. The two groups use
     * the same bar markup on purpose - and the fidelity guard measures the first `.cbar` in the
     * document, which is still this one, because #conf comes before #clusterCard. */
    const rows = [...document.querySelectorAll('#conf .cbar')];
    expect(rows.map((r) => text(r.querySelector('.t')))).toEqual(['p < 0.01', '0.01–0.05', '0.05–0.10', '≥ 0.10']);

    const s = kpiStats(DATA.spots, DATA.cities, INITIAL_STATE);
    const counts = rows.map((r) => Number(text(r.querySelector('.v'))));
    // The bins partition the in-scope set, so they must sum to it exactly.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(s.feats.length);
    expect(text(q('#conf .note'))).toBe(
      `${s.feats.filter((f) => f.properties.bh_significant).length} / ${s.feats.length} — BH`,
    );
    // The tallest bar is 100%; the fills stay on the plain ramp tokens, not the ink scale.
    const widths = rows.map((r) => Number.parseFloat(r.querySelector<HTMLElement>('.track i')!.style.width));
    expect(Math.max(...widths)).toBe(100);
    expect(rows[0].querySelector<HTMLElement>('.track i')!.style.background).toBe('var(--hot-5)');
  });
});
