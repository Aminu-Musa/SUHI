// @vitest-environment jsdom
/* The Compare tab, against the REAL data files.
 *
 * Every render goes through <StrictMode>, the way src/main.tsx does (standing rule from Task 2:
 * an effect that is not idempotent passes a bare render and double-fires in the real app).
 *
 * The fixtures are the shipped files rather than hand-written rows, and here that is
 * load-bearing twice over: the null cases these tests assert on - Abonnema has no night rows at
 * all, Bida's single night row carries no LST reading - are facts about the data the browser
 * fetches, and a synthetic fixture could be made to say whatever the test wanted.
 *
 * Several names below carry the REASON for the behaviour they pin, because the behaviour reads
 * as a defect until you know why. A future reader deleting one has to argue with the name first.
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { max } from 'd3';
import rawCss from '../styles/app.css?raw';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider } from '../app/state';
import { FIXTURE } from '../rail/fixtures';
import { INK_TOKENS } from '../../scripts/lib/ink.mjs';
import { Compare, DEFAULT_PICKED, togglePicked } from './Compare';
import { MEASURES, RAMP_FILL, figure, nationalMax } from './ClusteredBars';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

const mount = (initialPicked?: readonly string[]) =>
  render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <Compare data={FIXTURE} initialPicked={initialPicked} />
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const cards = () => qa('.cmp .card2');
/** The `.cbar` rows of one card, in measure order. */
const rowsOf = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('.cbar')];
const cityRow = (name: string, period: 'day' | 'night') =>
  FIXTURE.citiesByPeriod.find((r) => r.city === name && r.period === period);

describe('the picker', () => {
  test('renders one .pk per city, in cities.json order, with the four defaults pressed', () => {
    mount();
    const pk = qa('.picker .pk');
    expect(pk).toHaveLength(FIXTURE.cities.length);
    expect(pk.map((b) => b.textContent)).toEqual(FIXTURE.cities.map((c) => c.city));
    expect(pk.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(
      FIXTURE.cities.filter((c) => DEFAULT_PICKED.includes(c.city)).map((c) => c.city),
    );
    expect(DEFAULT_PICKED).toEqual(['Ibadan', 'Lagos', 'Kano', 'Maiduguri']);
  });

  test('picker allows up to five cities and no more', async () => {
    const user = userEvent.setup();
    mount();
    // A fifth is accepted: the cap is five, not revision 1's four.
    const unpicked = qa('.picker .pk').filter((b) => b.getAttribute('aria-pressed') === 'false');
    await user.click(unpicked[0]);
    expect(cards()).toHaveLength(5);
    expect(unpicked[0].getAttribute('aria-pressed')).toBe('true');

    // The sixth click does nothing at all - no card, no aria-pressed, no silent eviction.
    await user.click(unpicked[1]);
    expect(cards()).toHaveLength(5);
    expect(unpicked[1].getAttribute('aria-pressed')).toBe('false');

    // And a pressed button still toggles OFF while at the cap, which is the only way out.
    await user.click(unpicked[0]);
    expect(cards()).toHaveLength(4);
  });

  test('togglePicked adds, removes and refuses a sixth', () => {
    expect(togglePicked(['a'], 'b')).toEqual(['a', 'b']);
    expect(togglePicked(['a', 'b'], 'a')).toEqual(['b']);
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(togglePicked(five, 'f')).toEqual(five);
    expect(togglePicked(five, 'c')).toEqual(['a', 'b', 'd', 'e']);
  });

  // `.pk` is a real <button>, unlike ruling 42's clickable ROWS: its CSS is written against one
  // (background:none, its own font-size, border, border-radius) and aria-pressed is already
  // there, so swapping the element would be the change rather than the fidelity.
  test('.pk stays a real button, because .pk CSS is written for one (ruling 42 covers rows, not this)', () => {
    mount();
    for (const b of qa('.picker .pk')) expect(b.tagName).toBe('BUTTON');
  });

  test('an empty selection renders the original dash, not a bare grid', async () => {
    const user = userEvent.setup();
    mount(['Ibadan']);
    await user.click(qa('.picker .pk').find((b) => b.textContent === 'Ibadan')!);
    expect(cards()).toHaveLength(0);
    expect(q('.cmp .note')?.textContent).toBe('—');
  });

  test('cards appear in pick order, not table order', async () => {
    const user = userEvent.setup();
    mount(['Lagos']);
    await user.click(qa('.picker .pk').find((b) => b.textContent === 'Ibadan')!);
    // Ibadan is first in cities.json, but it was picked second.
    expect(cards().map((c) => c.querySelector('h4')?.textContent)).toEqual(['Lagos', 'Ibadan']);
  });
});

describe('the grid and the cards', () => {
  test('cards lay out in the original auto-fit minmax(240px, 1fr) grid', () => {
    mount();
    // jsdom does not lay out, so the assertion is on the rule the grid gets, in the stylesheet
    // the app ships. The rendered geometry is the fidelity guard's job.
    const grid = q('.cmp');
    expect(grid).not.toBeNull();
    expect(grid?.id).toBe('cmpGrid');
    expect(cards()).toHaveLength(4);
    for (const c of cards()) expect(c.parentElement).toBe(grid);
  });

  test('each card carries the 17px name, the 13px SUHI figure, the two notes and the footer trio', () => {
    mount(['Ibadan']);
    const [card] = cards();
    const h4 = card.querySelector('h4')!;
    expect(h4.textContent).toBe('Ibadan');
    expect(h4.style.fontSize).toBe('17px');
    const figureEl = h4.parentElement!.querySelector('span')!;
    expect(figureEl.style.fontSize).toBe('13px');
    expect(figureEl.textContent).toBe('+2.34 °C');

    const notes = [...card.querySelectorAll('.note')];
    expect(notes).toHaveLength(2);
    expect(notes[0].textContent).toBe('Grassland · Low (101-500m) · Undifferentiated basement complex');
    expect(notes[1].textContent).toBe('Cluster 9 — Grassland · 101–500 m · Basement complex');

    const footer = card.lastElementChild as HTMLElement;
    expect([...footer.children].map((d) => d.firstElementChild?.textContent)).toEqual([
      'Hot spots',
      'Cold spots',
      'Hot days',
    ]);
    expect([...footer.children].map((d) => d.lastElementChild?.textContent)).toEqual(['2', '2', '14']);
  });

  // The original writes `+${c.suhii}` with no sign test (prototype line 1083), and 18 of the 55
  // cities have a negative pooled SUHI - Maiduguri among the four the picker starts with. So the
  // original really prints "+-0.66 °C". Transcribed, not corrected: §9.1 does not list it and
  // the original is the visual authority. This test is the record of that decision.
  test('prints the header figure as +${suhii} verbatim, so a negative city reads "+-0.66 °C" exactly as the original does', () => {
    mount(['Maiduguri']);
    const [card] = cards();
    expect(FIXTURE.cities.find((c) => c.city === 'Maiduguri')!.suhii).toBe(-0.66);
    expect(card.querySelector('h4')!.parentElement!.querySelector('span')!.textContent).toBe('+-0.66 °C');
  });
});

describe('the bars', () => {
  test('each measure renders two bars, day and night', () => {
    mount(['Ibadan']);
    const rows = rowsOf(cards()[0]);
    expect(rows).toHaveLength(MEASURES.length);
    expect(MEASURES).toHaveLength(9);
    for (const row of rows) {
      expect(row.querySelectorAll('.track')).toHaveLength(2);
      expect(row.querySelectorAll('.track i')).toHaveLength(2);
      expect(row.querySelectorAll('.v')).toHaveLength(2);
      expect([...row.querySelectorAll('.track')].map((t) => t.getAttribute('data-period'))).toEqual([
        'day',
        'night',
      ]);
      expect([...row.querySelectorAll('.v')].map((v) => v.getAttribute('data-period'))).toEqual([
        'day',
        'night',
      ]);
      // One label for the pair, spanning both grid rows.
      expect(row.querySelectorAll('.t')).toHaveLength(1);
    }
    expect(rows.map((r) => r.querySelector('.t')!.textContent)).toEqual([
      'SUHI intensity', 'Mean LST', 'Max LST', 'Population inside hot spots',
      'Population inside cold spots', 'Hot-spot area', 'Hot share of city',
      'Cold-spot area', 'Warming trend',
    ]);
  });

  test('each bar draws its own period figure, not the pooled one', () => {
    mount(['Ibadan']);
    const [suhiRow] = rowsOf(cards()[0]);
    const vs = [...suhiRow.querySelectorAll('.v')].map((v) => v.textContent);
    expect(cityRow('Ibadan', 'day')!.suhii).toBe(3.43);
    expect(cityRow('Ibadan', 'night')!.suhii).toBe(1.26);
    expect(vs).toEqual(['3.4 °C', '1.3 °C']);
    // The pooled figure is 2.34 and appears ONCE, in the header - never as a bar.
    expect(vs).not.toContain('2.3 °C');
  });

  test('bars scale against the national maximum, not the selection', () => {
    // Two mid-ranked cities and nothing else. Akure's day SUHI of 3.66 is the national maximum
    // and Akure is NOT selected, so neither bar on screen may fill its track - which is what
    // rescaling to the selection would do, and what revision 1 did before the spec reverted it.
    mount(['Kano', 'Kaduna']);
    const natMax = nationalMax(FIXTURE.citiesByPeriod, 'suhii');
    expect(natMax).toBe(3.66);
    expect(FIXTURE.citiesByPeriod.find((r) => Math.abs(r.suhii) === natMax)!.city).toBe('Akure');

    const widths = cards().flatMap((card) =>
      [...rowsOf(card)[0].querySelectorAll<HTMLElement>('.track i')].map((i) => parseFloat(i.style.width)),
    );
    expect(widths).toHaveLength(4);
    for (const w of widths) expect(w).toBeLessThan(80);
    // And each one is exactly |value| / national maximum.
    const expected = ['Kano', 'Kaduna'].flatMap((name) =>
      (['day', 'night'] as const).map((p) => (Math.abs(cityRow(name, p)!.suhii) / natMax) * 100),
    );
    for (const [i, w] of widths.entries()) expect(w).toBeCloseTo(expected[i], 4);
  });

  // Why the denominator is the per-period table and not `d3.max(CITIES, …)` verbatim: a pooled
  // mean sits between a city's day and its night, so a day figure routinely exceeds the largest
  // POOLED figure in the country. Measured: 19 of 954 bars would exceed 100% and be clipped by
  // `overflow:hidden`, drawing Ibadan's 3.43 and Ife's 3.19 identically - the exact comparison
  // the lede promises. The scaling is still national and still not per selection.
  test('scales against the national maximum OF THE MEASURE DRAWN, because 19 of 954 bars would clip against the pooled maximum', () => {
    let clipped = 0;
    for (const m of MEASURES) {
      const pooled = max(FIXTURE.cities, (c) => Math.abs(c[m.k] as number)) ?? 1;
      for (const r of FIXTURE.citiesByPeriod) {
        const v = r[m.k];
        if (typeof v === 'number' && Math.abs(v) > pooled) clipped++;
      }
      // The per-period maximum is never smaller, so nothing can clip against it.
      expect(nationalMax(FIXTURE.citiesByPeriod, m.k)).toBeGreaterThanOrEqual(
        Math.max(...FIXTURE.citiesByPeriod.map((r) => Math.abs((r[m.k] as number | null) ?? 0))),
      );
    }
    expect(clipped).toBe(19);
    expect(FIXTURE.citiesByPeriod.length * MEASURES.length).toBe(954);
  });

  /* ASSERTED ON THE DERIVATION, NOT ON THE DOM, and the name says so because that looks like a
   * weaker test than it is. jsdom's CSS parser rejects a `var()` inside `linear-gradient()` and
   * drops the declaration entirely - measured: `el.style.background = 'linear-gradient(90deg,
   * var(--hot-2), var(--hot-5))'` leaves `style.background` as "" AND leaves no `style`
   * attribute behind, on `background` and `background-image` alike, while the same string
   * renders perfectly in a browser. So there is nothing in this environment to read back, and a
   * DOM assertion here would have been a test that passed against no fill at all. What is
   * pinned instead is the table the one call site indexes, which is where a wrong ramp would
   * actually come from. */
  test('bar fills use the original track-anchored gradients (asserted on RAMP_FILL: jsdom drops a var() gradient and leaves nothing to read back)', () => {
    expect(RAMP_FILL.hot).toBe('linear-gradient(90deg,var(--hot-2),var(--hot-5))');
    expect(RAMP_FILL.cold).toBe('linear-gradient(90deg,var(--cold-4),var(--cold-2))');
    // The two COLD measures are the original's: pop_in_cold (index 4) and cold_area (index 7).
    expect(MEASURES.map((m) => m.ramp)).toEqual([
      'hot', 'hot', 'hot', 'hot', 'cold', 'hot', 'hot', 'cold', 'hot',
    ]);
    // The `<i>` elements are still there and still sized, which is the half the DOM can carry.
    mount(['Ibadan']);
    for (const row of rowsOf(cards()[0])) {
      for (const i of row.querySelectorAll<HTMLElement>('.track i')) {
        expect(i.style.width).toMatch(/%$/);
      }
    }
  });

  /* Both bars take the SAME gradient; the night bar is distinguished by opacity alone, because
   * §7.5 fixes the fill and leaves nothing else free. The rule is CSS, and jsdom does not apply
   * stylesheets to computed style, so the only honest assertion is on the stylesheet's own text
   * (vite.config.ts sets `test.css: true`, without which `?raw` returns an empty string and
   * this would pass having checked nothing). */
  test('the night bar differs from the day bar by opacity only, which is the one variable §7.5 leaves free', () => {
    expect(rawCss.length).toBeGreaterThan(1000);
    expect(rawCss).toMatch(/\.cbar-dn>\.track\[data-period=night\] i\{opacity:\.55\}/);
    // And the two bars are placed on two grid rows of the same `.cbar`, not in two rows.
    expect(rawCss).toMatch(/\.cbar-dn\{grid-template-rows:auto auto;row-gap:3px\}/);
    expect(rawCss).toMatch(/\.cbar-dn>\.t\{grid-area:1\/1\/3\/2\}/);
  });

  // RULING 8. `.cbar .v` is a bare <span class="v"> in the original, inheriting --color-text. An
  // earlier draft of the spec attributed ramp colours to it; that usage does not exist. The real
  // coloured text in Compare is the 13px SUHI figure, the 11px cluster note and the footer trio.
  test('values beside the bars stay --color-text, as the original leaves them (ruling 8)', () => {
    mount();
    const vs = qa('.cmp .cbar .v');
    expect(vs.length).toBe(4 * MEASURES.length * 2);
    for (const v of vs) {
      expect(v.getAttribute('style')).toBeNull();
      expect(v.style.color).toBe('');
      expect(v.className).toBe('v');
    }
  });

  test('a measure with a null night value renders one bar and a dash', () => {
    // Bida has BOTH periods, and its single night feature carries no LST reading at all - so
    // mean_lst and max_lst are null for the night only. The pooled row hides this: cities.json
    // reports a finite mean_lst for Bida because its day rows are finite.
    mount(['Bida']);
    expect(cityRow('Bida', 'night')!.mean_lst).toBeNull();
    expect(Number.isFinite(FIXTURE.cities.find((c) => c.city === 'Bida')!.mean_lst)).toBe(true);

    const meanRow = rowsOf(cards()[0])[1];
    expect(meanRow.querySelector('.t')!.textContent).toBe('Mean LST');
    // Two tracks still, but one bar: the <i> is omitted rather than given width 0, because a
    // zero-length bar is a claim that the value is zero and pop_cold really is 0 for 20 cities.
    expect(meanRow.querySelectorAll('.track')).toHaveLength(2);
    expect(meanRow.querySelectorAll('.track i')).toHaveLength(1);
    expect(meanRow.querySelector('.track[data-period=day] i')).not.toBeNull();
    expect(meanRow.querySelector('.track[data-period=night] i')).toBeNull();
    // And the dash carries NO unit: "— °C" claims a reading in degrees that does not exist.
    expect([...meanRow.querySelectorAll('.v')].map((v) => v.textContent)).toEqual(['52.5 °C', '—']);
  });

  test('a city with no rows for a period at all renders a dash down the whole column', () => {
    // Abonnema has no night features in spots.geojson, so there is no night row to look up.
    mount(['Abonnema']);
    expect(cityRow('Abonnema', 'night')).toBeUndefined();
    const rows = rowsOf(cards()[0]);
    for (const row of rows) {
      expect(row.querySelector('.track[data-period=night] i')).toBeNull();
      expect(row.querySelector('.v[data-period=night]')!.textContent).toBe('—');
      expect(row.querySelector('.track[data-period=day] i')).not.toBeNull();
    }
  });

  test('figure appends the unit only to a real number', () => {
    const m = MEASURES[0];
    expect(figure(2.34, m)).toBe('2.3 °C');
    expect(figure(null, m)).toBe('—');
    expect(figure(undefined, m)).toBe('—');
    // A unit-less measure is not given a stray space.
    expect(figure(4579, MEASURES[3])).toBe('4,579');
  });

  test('nationalMax ignores nulls and never returns zero', () => {
    expect(nationalMax([], 'suhii')).toBe(1);
    expect(nationalMax(FIXTURE.citiesByPeriod.filter((r) => r.city === 'Bida'), 'max_lst')).toBeGreaterThan(0);
  });
});

describe('the ramp read as text', () => {
  test('the per-card SUHI figure interpolates the hot INK ramp', () => {
    mount(['Ibadan']);
    const span = cards()[0].querySelector('h4')!.parentElement!.querySelector('span')!;
    // Ibadan's 2.34 lands between --hot-3-ink (1.8) and --hot-4-ink (2.7), so the colour must be
    // an INTERPOLATION - equal to neither endpoint - and must come from the ink ramp, not the
    // fill ramp the original used. One definition: src/map/ink.ts (ruling 32).
    const ink = INK_TOKENS('nocturne') as Record<string, string>;
    const colour = span.style.color;
    expect(colour).not.toBe('');
    expect(colour).not.toBe(ink['--hot-3-ink']);
    expect(colour).not.toBe(ink['--hot-4-ink']);
    // Not a var(): d3 has to mix two concrete colours, so this is a resolved value.
    expect(colour).not.toMatch(/var\(/);
    expect(colour).toMatch(/^rgb|^#/);
  });

  test('the per-card SUHI figure re-interpolates when the theme changes', () => {
    document.documentElement.dataset.theme = 'modernist';
    try {
      window.localStorage.setItem('suhi.theme', 'modernist');
    } catch {
      /* a blocked store just means ThemeProvider uses its default */
    }
    mount(['Ibadan']);
    const light = cards()[0].querySelector('h4')!.parentElement!.querySelector('span')!.style.color;
    cleanup();
    try {
      window.localStorage.setItem('suhi.theme', 'nocturne');
    } catch {
      /* as above */
    }
    mount(['Ibadan']);
    const dark = cards()[0].querySelector('h4')!.parentElement!.querySelector('span')!.style.color;
    expect(light).not.toBe(dark);
  });

  test('the cluster note uses --accent-ink', () => {
    mount(['Ibadan']);
    const notes = [...cards()[0].querySelectorAll<HTMLElement>('.note')];
    expect(notes[1].style.color).toBe('var(--accent-ink)');
    // The first note is the landcover line and is NOT coloured.
    expect(notes[0].style.color).toBe('');
  });

  test('the footer trio uses --hot-4-ink / --cold-4-ink', () => {
    mount(['Ibadan']);
    const footer = cards()[0].lastElementChild as HTMLElement;
    const vals = [...footer.children].map((d) => d.lastElementChild as HTMLElement);
    expect(vals.map((v) => v.style.fontSize)).toEqual(['19px', '19px', '19px']);
    expect(vals.map((v) => v.style.color)).toEqual(['var(--hot-4-ink)', 'var(--cold-4-ink)', 'inherit']);
    // DISCRETE tokens as var(), not resolved hexes: these do not interpolate, so they can
    // re-resolve on a theme flip with no re-render at all.
    expect(vals[0].style.color).toMatch(/^var\(/);
  });
});

describe('the day/night key', () => {
  // The one element Compare adds to the original's markup. §7.5 doubles the bars and fixes their
  // gradient, so opacity is all that separates a night bar from a day one - and an opacity
  // difference with no key is not readable.
  test('one legend names both periods, because opacity is the only thing left to tell the bars apart', () => {
    mount();
    const legend = q('#cmpLegend');
    expect(legend?.className).toBe('note');
    expect([...legend!.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['Day', 'Night']);
    expect([...legend!.querySelectorAll('i')].map((i) => i.getAttribute('data-period'))).toEqual([
      'day',
      'night',
    ]);
  });

  test('every track is titled with its period, so a bar is identifiable without the key', () => {
    mount(['Ibadan']);
    const tracks = [...rowsOf(cards()[0])[0].querySelectorAll('.track')];
    expect(tracks.map((t) => t.getAttribute('title'))).toEqual([
      'Day · SUHI intensity',
      'Night · SUHI intensity',
    ]);
  });
});
