// @vitest-environment jsdom
/* The Reports tab, against the REAL data files.
 *
 * Every render goes through <StrictMode>, the way src/main.tsx does (standing rule from Task 2).
 *
 * THEME IS SEEDED THROUGH localStorage, NEVER by setting data-theme. Task 9 found that
 * `ThemeProvider` WRITES `document.documentElement.dataset.theme` in an effect rather than
 * reading it, so a test that sets the attribute itself has it overwritten on mount and runs
 * against the DEFAULT theme's tokens while appearing to assert the other one's. Ruling 6 makes
 * `localStorage['suhi.theme']` the input, and every theme-sensitive test below asserts the
 * provider actually took the theme before comparing anything.
 *
 * Several test names carry the REASON for the behaviour they pin. A future reader deleting one
 * has to argue with the name first.
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawCss from '../styles/app.css?raw';
import rawTokens from '../styles/suhi-tokens.css?raw';
import { ThemeProvider, THEME_KEY } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider, type State } from '../app/state';
import { FIXTURE } from '../rail/fixtures';
import { INK_TOKENS } from '../../scripts/lib/ink.mjs';
import { contrastRatio } from '../../scripts/lib/color.mjs';
import { THEME_TOKENS } from '../../scripts/lib/tokens.mjs';
import { EXPORT_OPTIONS, csvText, spotRecordRows } from '../lib/export';
import { Reports, briefCity } from './Reports';
import { fmt } from '../rail/stats';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

interface MountOpts {
  readonly state?: Partial<State>;
  readonly theme?: 'nocturne' | 'modernist';
  readonly onPrint?: () => void;
  readonly onSave?: (blob: Blob, filename: string) => void;
}

function mount({ state, theme, onPrint, onSave }: MountOpts = {}) {
  if (theme) window.localStorage.setItem(THEME_KEY, theme);
  return render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider initial={state}>
            <Reports data={FIXTURE} onPrint={onPrint} onSave={onSave} />
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const brief = () => q('.brief')!;
/** The four 23px figure values, in the original's column order. */
const figures = () => qa('.brief [style*="23px"]');
const select = () => q('#exports select') as HTMLSelectElement;
const downloadBtn = () => q('#exports button');
/** The one declaration block app.css gives a selector, whitespace-normalised. */
const ruleFor = (sel: string, css = rawCss): string => {
  const m = new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  expect(m, `app.css has no rule for ${sel}`).toBeTruthy();
  return m![2].replace(/\s+/g, '');
};

describe('the brief', () => {
  test('brief renders at the original 640px in the original surface', () => {
    mount();
    // The ELEMENT carries the original's class and id, so app.css sizes it (prototype line 391).
    expect(brief().className).toBe('brief');
    expect(brief().id).toBe('brief');
    // ...and the rule itself is the original's: 640px on --ui-panel-2 with 34/38px padding.
    const rule = ruleFor('.brief');
    expect(rule).toContain('width:640px');
    expect(rule).toContain('background:var(--ui-panel-2)');
    expect(rule).toContain('padding:34px38px');
    // No inline width anywhere on it: a width here would silently win over the sheet.
    expect(brief().style.width).toBe('');
  });

  test('the city is state.city, or Ibadan, exactly as prototype line 1133 chooses it', () => {
    mount();
    expect(q('.brief h3')!.textContent).toBe('Ibadan');
    cleanup();
    mount({ state: { city: 'Kano' } });
    expect(q('.brief h3')!.textContent).toBe('Kano');
  });

  test('an unknown scoped city falls back to the first row rather than rendering an empty brief', () => {
    mount({ state: { city: 'Atlantis' } });
    expect(q('.brief h3')!.textContent).toBe(FIXTURE.cities[0].city);
    expect(briefCity(FIXTURE.cities, 'Atlantis')).toBe(FIXTURE.cities[0]);
  });

  test('the structure is the original four blocks separated by three .rule divs', () => {
    mount();
    expect(qa('.brief .rule')).toHaveLength(3);
    expect(qa('.brief h3')).toHaveLength(1);
    expect(qa('.brief p')).toHaveLength(1);
    // The header's right-aligned wordmark and the method note are both `.note`, as is the
    // subtitle under the city name: three in all (prototype lines 1136-1138 and 1167).
    expect(qa('.brief .note')).toHaveLength(3);
  });

  test('the subtitle keeps the original string surgery, oddity and all', () => {
    /* `T('composite')` is '2024 composite' and line 1137 drops its FIRST word, so English reads
     * "SUHI · 2024 composite". Transcribed rather than corrected: the surgery is the approved
     * page's, and the fix belongs in the dictionary. */
    mount();
    expect(qa('.brief .note')[0].textContent).toBe('SUHI · 2024 composite');
  });
});

describe('the four figures (ruling 20)', () => {
  test('the four brief figures render at 23px and use the ink scale', () => {
    mount();
    const f = figures();
    expect(f).toHaveLength(4);
    for (const el of f) {
      // 23px EXACTLY, and the weight token, both reproduced from prototype line 1143.
      expect(el.style.fontSize).toBe('23px');
      expect(el.style.fontWeight).toBe('var(--font-heading-weight)');
      expect(el.style.fontFamily).toBe('var(--font-heading)');
      // The CSSOM re-serialises the original's `-.02em` with its leading zero. Same value.
      expect(el.style.letterSpacing).toBe('-0.02em');
    }
    // The three coloured ones are INK, not fill; the fourth has no colour in the original.
    expect(f.map((el) => el.style.color)).toEqual([
      'var(--hot-4-ink)',
      'var(--cold-4-ink)',
      'var(--hot-5-ink)',
      'inherit',
    ]);
    // The three FILL tokens appear on no figure at all, which is the thing ruling 20 forbids.
    const inline = f.map((el) => el.getAttribute('style')).join(' ');
    for (const fill of ['var(--hot-4)', 'var(--cold-4)', 'var(--hot-5)']) {
      expect(inline, `${fill} is a fill and must not colour 23px text`).not.toContain(fill);
    }
  });

  test('the values are the original four fields, unformatted except pop_hot', () => {
    mount({ state: { city: 'Ibadan' } });
    const c = FIXTURE.cities.find((x) => x.city === 'Ibadan')!;
    expect(figures().map((el) => el.textContent)).toEqual([
      String(c.hot),
      String(c.cold),
      `${c.pct_hot}%`,
      // `fmt` is the only formatter the original applies here, and only to the population.
      c.pop_hot.toLocaleString('en-US'),
    ]);
  });

  test('23px is ONE PIXEL below WCAG large text, so the weight token decides the floor', () => {
    /* This is the whole of ruling 20, asserted on the numbers rather than trusted. The
     * any-weight large-text threshold is 24px (18.66px at weight >= 700), so at 23px the floor
     * is 4.5:1 unless the weight reaches 700. The two themes land on OPPOSITE sides of that. */
    const weights = Object.fromEntries(
      ['nocturne', 'modernist'].map((t) => [
        t,
        Number(
          /--font-heading-weight:\s*(\d+)/.exec(
            rawTokens.split(`data-theme="${t}"`)[1] ?? rawTokens.split(`data-theme=${t}`)[1] ?? '',
          )?.[1] ?? NaN,
        ),
      ]),
    );
    expect(weights.nocturne).toBe(500);
    expect(weights.modernist).toBe(800);
    expect(weights.nocturne).toBeLessThan(700); // body text at 23px: 4.5:1 applies
    expect(weights.modernist).toBeGreaterThanOrEqual(700); // large text at 23px: 3.0:1 applies
  });

  test('all three fills FAIL 4.5:1 on --ui-panel-2 in Nocturne, where 23px is body text', () => {
    const ground = THEME_TOKENS.nocturne['--ui-panel-2'];
    const ratios = ['--hot-4', '--cold-4', '--hot-5'].map(
      (t) => Math.round(contrastRatio(THEME_TOKENS.nocturne[t], ground) * 100) / 100,
    );
    // The exact figures ruling 20 cites. A token edit that moved any of them speaks up here.
    expect(ratios).toEqual([4.25, 2.49, 2.75]);
    for (const r of ratios) expect(r).toBeLessThan(4.5);
  });

  test('the three INK siblings clear 4.5:1 on --ui-panel-2 in BOTH themes', () => {
    /* Which is why the colour can move rather than the type: one swap satisfies both floors at
     * once, so no theme is left with illegible figures and neither 23px nor the weight changes. */
    for (const theme of ['nocturne', 'modernist'] as const) {
      const ground = THEME_TOKENS[theme]['--ui-panel-2'];
      const ink = INK_TOKENS(theme) as Record<string, string>;
      for (const t of ['--hot-4-ink', '--cold-4-ink', '--hot-5-ink']) {
        expect(contrastRatio(ink[t], ground), `${theme} ${t}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('the ink tokens re-resolve on a theme flip with no re-render, because they stay var()', () => {
    /* A resolved hex would freeze Nocturne's ink into a Modernist page. The figures carry
     * `var(--…-ink)` strings, so flipping data-theme is the whole repaint. */
    mount({ theme: 'modernist' });
    expect(document.documentElement.dataset.theme).toBe('modernist');
    expect(figures()[0].style.color).toBe('var(--hot-4-ink)');
    expect(figures()[0].style.color).not.toMatch(/#|rgb/);
  });
});

describe('the prose (§9.1 bug 11)', () => {
  test('a negative city reads -0.66 °C, where the original prints +-0.66 °C', () => {
    const negative = FIXTURE.cities.filter((c) => c.suhii < 0);
    // A live check rather than a theoretical one: 18 cities take this branch.
    expect(negative).toHaveLength(18);
    mount({ state: { city: negative[0].city } });
    const text = q('.brief p')!.textContent!;
    expect(text).toContain(`intensity of ${negative[0].suhii} °C`);
    expect(text).not.toContain('+-');
  });

  test('a positive city still reads with its +, so the sign was fixed and not removed', () => {
    mount({ state: { city: 'Ibadan' } });
    expect(q('.brief p')!.textContent).toContain('intensity of +2.34 °C');
  });

  test('no negative value anywhere in the brief is preceded by a bare +', () => {
    for (const c of FIXTURE.cities.filter((x) => x.suhii < 0 || x.slope < 0).slice(0, 6)) {
      cleanup();
      mount({ state: { city: c.city } });
      expect(brief().textContent, c.city).not.toContain('+-');
    }
  });

  test('the prose interpolates every field the plan named, so none is missing from the data', () => {
    mount({ state: { city: 'Ibadan' } });
    const c = FIXTURE.cities.find((x) => x.city === 'Ibadan')!;
    const k = FIXTURE.clusters.find((x) => x.id === c.cluster)!;
    const text = q('.brief p')!.textContent!;
    for (const part of [
      `maximum land surface temperature of ${c.max_lst.toFixed(1)} °C`,
      `across ${c.hotdays} MODIS hot days`,
      `${c.pct_hot}% of the ${Math.round(c.city_area).toLocaleString('en-US')} km² study extent`,
      `contain ${c.pop_hot.toLocaleString('en-US')} people`,
      `Sen slope over the record is +${c.slope} °C per decade`,
      `landcover inside the contours is ${c.landcover.toLowerCase()}`,
      `the terrain is ${c.elev.toLowerCase()}`,
      `on ${c.geol.toLowerCase()}`,
      `cluster ${c.cluster} — ${k.typology} —`,
      // `n_cities - 1`: the OTHER cities in the typology, prototype line 1166.
      `shares with ${k.n_cities - 1} other cities`,
    ]) {
      expect(text, part).toContain(part);
    }
  });

  test('the method note carries c.sig and the fixed correction string', () => {
    mount({ state: { city: 'Ibadan' } });
    const note = qa('.brief .note')[2].textContent!;
    expect(note).toBe(
      'Method: Getis-Ord Gi* on MODIS LST, Benjamini–Hochberg corrected. Contours at L50/L75/L90. 0 significant after correction.',
    );
  });
});

describe('the export column (spec §7.7)', () => {
  test('the .expgrid container and its column position are unchanged', () => {
    mount();
    const grid = q('.expgrid')!;
    expect(grid.id).toBe('exports');
    // §7.7: the CONTAINER does not move; only its contents change.
    const rule = ruleFor('.expgrid');
    expect(rule).toContain('grid-template-columns:repeat(auto-fit,minmax(210px,1fr))');
    // It still sits under the `Data export` section heading, with the filters note below it.
    const col = grid.parentElement!;
    expect(col.firstElementChild!.className).toBe('sec-h');
    expect(col.firstElementChild!.textContent).toBe('Data export');
    expect(grid.nextElementSibling!.className).toBe('note');
    expect(grid.nextElementSibling!.textContent).toBe(
      'Exports carry the active filters: contour level, cluster and year.',
    );
  });

  test('the export select carries the original six labels and descriptions verbatim', () => {
    mount();
    const opts = [...select().options].slice(1); // the first is the empty placeholder
    expect(opts).toHaveLength(6);
    expect(opts.map((o) => o.textContent)).toEqual([
      'City brief (PDF) — One page per selected city.',
      'Full report (PDF) — All 55 cities with national summary.',
      'Spot records (CSV) — 441 rows · 30 fields.',
      'Contours (GeoJSON) — EPSG:4326, current view.',
      'Contours (TopoJSON) — Compact geometry for the web.',
      'City aggregates (CSV) — 55 rows.',
    ]);
    expect(opts.map((o) => o.value)).toEqual(EXPORT_OPTIONS.map((o) => o.value));
  });

  test('the six cards are GONE - §7.7 replaces them, it does not add a select beside them', () => {
    mount();
    expect(qa('#exports .card2')).toHaveLength(0);
    expect(qa('#exports select')).toHaveLength(1);
  });

  test('Download button is absent until a format is chosen', () => {
    mount();
    expect(select().value).toBe('');
    // ABSENT, not disabled: a disabled button is a control the reader can see and cannot use,
    // and §7.7 asks for one that appears.
    expect(downloadBtn()).toBeNull();
    expect(qa('#exports button')).toHaveLength(0);
  });

  test('choosing a format reveals Download', async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(select(), 'spot-records-csv');
    const btn = downloadBtn()!;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Download');
    expect(btn.className).toBe('ghost');
  });

  test('going back to the placeholder hides it again', async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(select(), 'contours-geojson');
    expect(downloadBtn()).not.toBeNull();
    await user.selectOptions(select(), '');
    expect(downloadBtn()).toBeNull();
  });
});

describe('the Download button does something (ruling 40)', () => {
  test('a PDF option goes to the print dialog, since no PDF library was added', async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const onSave = vi.fn();
    mount({ onPrint, onSave });
    await user.selectOptions(select(), 'city-brief-pdf');
    await user.click(downloadBtn()!);
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  test('each of the four data formats saves a named, non-empty Blob', async () => {
    for (const o of EXPORT_OPTIONS.filter((x) => x.kind === 'download')) {
      cleanup();
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onPrint = vi.fn();
      mount({ onPrint, onSave });
      await user.selectOptions(select(), o.value);
      await user.click(downloadBtn()!);
      expect(onSave, o.label).toHaveBeenCalledTimes(1);
      const [blob, filename] = onSave.mock.calls[0] as [Blob, string];
      expect(blob.size, o.label).toBeGreaterThan(100);
      expect(filename, o.label).toBe(o.filename);
      expect(onPrint, o.label).not.toHaveBeenCalled();
    }
  });

  test('export carries the active contour, cluster and year filters', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    mount({ state: { contour: 'L90', cluster: '9', year: 2015 }, onSave });
    await user.selectOptions(select(), 'spot-records-csv');
    await user.click(downloadBtn()!);
    const [blob] = onSave.mock.calls[0] as [Blob];
    const text = (await blob.text()).replace(/^﻿/, '');

    // The same filters applied directly must produce the same file - so the component is
    // reading app state rather than exporting everything and labelling it.
    const { columns, rows } = spotRecordRows(FIXTURE.spots, {
      contour: 'L90', cluster: '9', year: 2015, city: null,
    });
    expect(text).toBe(csvText(columns, rows));

    // And the narrowing is real: fewer rows than the unfiltered 441, every one L90/cluster 9.
    const lines = text.replace(/\r\n$/, '').split('\r\n');
    expect(lines.length - 1).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(441);
    expect(new Set(rows.map((r) => r.contour_level))).toEqual(new Set(['L90']));
    expect(new Set(rows.map((r) => String(r.cluster25)))).toEqual(new Set(['9']));
    expect(new Set(rows.map((r) => r.year))).toEqual(new Set([2015]));
  });

  test('the city scope travels too, which is what "current view" on the card means', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    mount({ state: { city: 'Kano' }, onSave });
    await user.selectOptions(select(), 'contours-geojson');
    await user.click(downloadBtn()!);
    const [blob] = onSave.mock.calls[0] as [Blob];
    const fc = JSON.parse(await blob.text()) as { features: { properties: { city: string } }[] };
    expect(fc.features.length).toBeGreaterThan(0);
    expect(new Set(fc.features.map((x) => x.properties.city))).toEqual(new Set(['Kano']));
  });
});

describe('before the data lands', () => {
  test('the brief is an empty .brief and the select still works, as the rail does', () => {
    /* The original built the whole panel inside the Promise.all callback, so there was nothing
     * to see at all. Here the chrome renders and only the figures wait - the same shape Task 4
     * gave the rail. The empty `.brief` is what the fidelity guard needs to exist. */
    render(
      <StrictMode>
        <ThemeProvider>
          <I18nProvider>
            <AppStateProvider>
              <Reports data={null} />
            </AppStateProvider>
          </I18nProvider>
        </ThemeProvider>
      </StrictMode>,
    );
    expect(q('.brief')).not.toBeNull();
    expect(q('.brief')!.textContent).toBe('');
    expect([...select().options]).toHaveLength(7);
    expect(q('.expgrid')).not.toBeNull();
  });
});

describe('ruling 49 - "Full report (PDF)" prints all 55 cities', () => {
  /* The card advertises "All 55 cities with national summary" and `window.print()` prints the
   * DOM, which held exactly one brief. That is the same defect as the original's six dead
   * Download buttons: a promise the UI makes and does not keep.
   *
   * The load-bearing assertion in every test here is made INSIDE the `onPrint` spy. What
   * matters is not that a container existed at some point, it is that the 55 briefs are in the
   * document AT THE MOMENT print runs - `window.print()` is synchronous and blocking, so a
   * container mounted one commit later would never reach the dialog. */

  /** What the DOM held when print() was called. */
  function printSnapshot() {
    const seen: { briefs: number; names: string[]; hidden: string | null; aria: string | null } = {
      briefs: -1,
      names: [],
      hidden: null,
      aria: null,
    };
    const onPrint = vi.fn(() => {
      const all = q('#printAll');
      seen.briefs = all ? all.querySelectorAll('.brief').length : 0;
      seen.names = all ? [...all.querySelectorAll('h3')].map((h) => h.textContent ?? '') : [];
      seen.hidden = all ? all.style.display : null;
      seen.aria = all ? all.getAttribute('aria-hidden') : null;
    });
    return { onPrint, seen };
  }

  test('the DOM holds all 55 city briefs plus a national summary at the moment print runs', async () => {
    const user = userEvent.setup();
    const { onPrint, seen } = printSnapshot();
    mount({ onPrint });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);

    expect(onPrint).toHaveBeenCalledTimes(1);
    // 55 cities plus the summary page that introduces them.
    expect(seen.briefs).toBe(FIXTURE.cities.length + 1);
    expect(FIXTURE.cities).toHaveLength(55);
    expect(seen.names[0]).toBe('Nigeria');
    expect(seen.names.slice(1)).toEqual(FIXTURE.cities.map((c) => c.city));
  });

  test('the container is invisible on screen even in the frames it exists for', async () => {
    /* An inline `display:none` plus `aria-hidden`, lifted only by `#printAll` in print.css. No
     * rule is added to app.css, so the screen gains no pixel and the fidelity guard sees
     * nothing - which is also why it is rendered ON DEMAND rather than always. */
    const user = userEvent.setup();
    const { onPrint, seen } = printSnapshot();
    mount({ onPrint });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);
    expect(seen.hidden).toBe('none');
    expect(seen.aria).toBe('true');
  });

  test('the container is gone again once the dialog has been handed the DOM', async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    mount({ onPrint });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);
    expect(q('#printAll')).toBeNull();
    // And the single brief the reader can see is untouched: still one, still the scoped city.
    expect(qa('.brief')).toHaveLength(1);
  });

  test('"City brief (PDF)" mounts nothing, because one city is what that option promises', async () => {
    const user = userEvent.setup();
    const { onPrint, seen } = printSnapshot();
    mount({ onPrint });
    await user.selectOptions(select(), 'city-brief-pdf');
    await user.click(downloadBtn()!);
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(seen.briefs).toBe(0);
  });

  test('the 55 briefs come AFTER the visible one, so the fidelity guard still measures the real brief', async () => {
    /* Pass 3e selects `#panel-report .brief` and `#panel-report .brief div` at 23px, and both
     * take the FIRST match in document order. The container being last is what keeps that true
     * even in the frames it is mounted. */
    const user = userEvent.setup();
    const order = vi.fn(() => {
      const briefs = qa('.brief');
      expect(briefs[0].id).toBe('brief');
      expect(q('#printAll')!.compareDocumentPosition(briefs[0]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });
    mount({ onPrint: order });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);
    expect(order).toHaveBeenCalledTimes(1);
  });

  test('the national summary is aggregated from the same 55 rows, so it cannot disagree with them', async () => {
    const user = userEvent.setup();
    let summary = '';
    const onPrint = vi.fn(() => {
      summary = q('#printAll .brief')!.textContent ?? '';
    });
    mount({ onPrint });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);

    const hot = FIXTURE.cities.reduce((n, c) => n + c.hot, 0);
    const cold = FIXTURE.cities.reduce((n, c) => n + c.cold, 0);
    const popHot = FIXTURE.cities.reduce((n, c) => n + c.pop_hot, 0);
    expect(summary).toContain(`This report covers ${FIXTURE.cities.length} Nigerian cities`);
    expect(summary).toContain(fmtTotal(hot));
    expect(summary).toContain(fmtTotal(cold));
    expect(summary).toContain(fmtTotal(popHot));
    // No NaN, no undefined, no `+-`: the mean goes through the same `signed` as every other
    // intensity on the page.
    expect(summary).not.toMatch(/NaN|undefined|null|\+-/);
  });

  test('the full report prints the NEGATIVE cities correctly too, which is §9.1 bug 11 at scale', async () => {
    /* The default brief is Ibadan (+2.34), so bug 11 was invisible on a freshly loaded page.
     * The full report prints all 18 negative cities on every run, which is where a bare `+`
     * would now be impossible to miss. */
    const user = userEvent.setup();
    let text = '';
    const onPrint = vi.fn(() => {
      text = q('#printAll')!.textContent ?? '';
    });
    mount({ onPrint });
    await user.selectOptions(select(), 'full-report-pdf');
    await user.click(downloadBtn()!);

    const negative = FIXTURE.cities.filter((c) => c.suhii < 0);
    expect(negative.length).toBeGreaterThan(0);
    expect(text).not.toContain('+-');
    for (const c of negative) {
      expect(text, c.city).toContain(`intensity of ${c.suhii} °C`);
    }
  });
});

/** d3's thousands format, as `fmt` applies it - imported rather than reimplemented. */
const fmtTotal = (n: number) => fmt(n);
