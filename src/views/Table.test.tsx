// @vitest-environment jsdom
/* The Data table tab, against the REAL data files.
 *
 * Every render goes through <StrictMode>, the way src/main.tsx does (standing rule from Task 2).
 *
 * ONE SUITE USES A HAND-BUILT FIXTURE AND SAYS SO IN ITS NAME. `fmt()` returns an em dash for
 * null, Task 4 proved that by mutation, and six of the seventeen columns go through it - but not
 * one of the seventeen is null in any of the 55 shipped rows (asserted below, so the claim is
 * checked rather than remembered). A test that quietly swapped in a fixture while reading as
 * though it checked production data would be worse than no test, so the fixture is in the name.
 *
 * Several other names carry the REASON for the behaviour they pin, because the behaviour reads
 * as a defect until you know why: the sort's direction asymmetry, the zero slope inked cold.
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider } from '../app/state';
import type { City, SuhiData } from '../app/data';
import { FIXTURE } from '../rail/fixtures';
import { INK_TOKENS } from '../../scripts/lib/ink.mjs';
import { COLS, DEFAULT_SORT, Table, nextSort, sortCities, type ColKey } from './Table';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
});

const mount = (data: SuhiData | null = FIXTURE, onOpenCity?: (c: string) => void) =>
  render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <Table data={data} onOpenCity={onOpenCity} />
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );

const qa = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const heads = () => qa('#tbl thead th');
const bodyRows = () => qa('#tbl tbody tr');
/** The nth cell of every body row, in render order. */
const column = (n: number) => bodyRows().map((r) => r.children[n] as HTMLElement);
const cityOrder = () => bodyRows().map((r) => r.dataset.c);
const CITIES = FIXTURE.cities;

const KEYS: readonly ColKey[] = [
  'city', 'hot', 'cold', 'suhii', 'mean_lst', 'max_lst', 'pop_hot', 'pop_cold', 'area_hot',
  'pct_hot', 'area_cold', 'slope', 'hotdays', 'cluster', 'landcover', 'elev', 'geol',
];

describe('the columns', () => {
  test('renders all 17 columns in the original order, spec §7.6 reverting the seven-plus-toggle', () => {
    mount();
    expect(heads()).toHaveLength(17);
    expect(heads().map((th) => th.dataset.k)).toEqual(KEYS);
    expect(COLS.map((c) => c.k)).toEqual(KEYS);
    // Every row carries all 17 cells too - a header-only check would miss a dropped <td>.
    expect(bodyRows()).toHaveLength(CITIES.length);
    expect(new Set(bodyRows().map((r) => r.children.length))).toEqual(new Set([17]));
  });

  test('the headings are the original labels, including the three it never translated', () => {
    mount();
    expect(heads().map((th) => th.textContent)).toEqual([
      'City', 'hot', 'cold', 'SUHI °C ↓', 'Mean LST', 'Max LST',
      'Population inside hot spots', 'Population inside cold spots', 'Hot-spot area', '% hot',
      'Cold-spot area', '°C/dec', 'Hot days', 'Cluster', 'Landcover', 'Elevation', 'Geology',
    ]);
  });

  test('renders the table chrome the fidelity guard selects on', () => {
    mount();
    const t = document.querySelector('table')!;
    expect(t.className).toBe('dt');
    expect(t.id).toBe('tbl');
    expect(t.querySelector('thead')).not.toBeNull();
    expect(t.querySelector('tbody')).not.toBeNull();
  });

  test('renders no rows and no error before the data lands', () => {
    mount(null);
    expect(heads()).toHaveLength(17);
    expect(bodyRows()).toHaveLength(0);
  });
});

describe('formatting', () => {
  test('the six fmt columns are grouped and the five raw ones are not, as the original wrote them', () => {
    mount();
    const ibadan = bodyRows().find((r) => r.dataset.c === 'Ibadan')!;
    const cell = (n: number) => (ibadan.children[n] as HTMLElement).textContent;
    const c = CITIES.find((x) => x.city === 'Ibadan')!;
    expect(cell(0)).toBe('Ibadan');
    expect(cell(1)).toBe(String(c.hot));
    expect(cell(4)).toBe('31.2'); // mean_lst, one decimal
    expect(cell(5)).toBe('43.3'); // max_lst, one decimal
    expect(cell(6)).toBe('15,378'); // pop_hot, grouped
    expect(cell(8)).toBe('89'); // area_hot, no decimals
    // pct_hot keeps its own precision and takes no separator: the original never calls fmt here.
    expect(cell(9)).toBe(String(c.pct_hot));
    expect(cell(12)).toBe(String(c.hotdays));
    expect(cell(13)).toBe(String(c.cluster));
  });

  test('the sign before suhii and slope is conditional, so §9.1 bug 11 cannot appear here', () => {
    mount();
    // 18 of the 55 cities are negative, and renderTable (line 1117) already writes
    // `suhii > 0 ? '+' : ''` - unlike the three places that wrote a bare `+` and produced
    // `+-0.66`. If this table ever grows a bare `+`, these two assertions go red.
    const negatives = CITIES.filter((c) => c.suhii < 0);
    expect(negatives.length).toBe(18);
    expect(column(3).map((td) => td.textContent).filter((s) => s!.startsWith('+-'))).toEqual([]);
    expect(column(11).map((td) => td.textContent).filter((s) => s!.startsWith('+-'))).toEqual([]);
    const suhiiText = new Map(bodyRows().map((r) => [r.dataset.c, (r.children[3] as HTMLElement).textContent]));
    for (const c of CITIES) {
      expect(suhiiText.get(c.city)).toBe(`${c.suhii > 0 ? '+' : ''}${c.suhii}`);
    }
  });

  test('a null numeric cell renders an em dash — DRIVEN FROM A HAND-BUILT FIXTURE, because no column is null in any of the 55 shipped rows', () => {
    // The premise, checked rather than asserted in prose: the real data cannot reach this path.
    for (const k of KEYS) {
      expect(CITIES.filter((c) => c[k as keyof City] == null), `${k} is null somewhere`).toEqual([]);
    }
    const holed: City = {
      ...CITIES[0],
      city: 'Nowhere',
      mean_lst: null as unknown as number,
      max_lst: null as unknown as number,
      pop_hot: null as unknown as number,
      pop_cold: null as unknown as number,
      area_hot: null as unknown as number,
      area_cold: null as unknown as number,
    };
    mount({ ...FIXTURE, cities: [holed] });
    const row = bodyRows()[0];
    // The six fmt columns, by index: mean_lst, max_lst, pop_hot, pop_cold, area_hot, area_cold.
    for (const n of [4, 5, 6, 7, 8, 10]) {
      expect((row.children[n] as HTMLElement).textContent, `cell ${n}`).toBe('—');
    }
  });
});

describe('the ink scale', () => {
  const ink = (theme: 'nocturne' | 'modernist') => INK_TOKENS(theme) as Record<string, string>;

  test('the four discrete coloured columns take ink TOKENS, not fill tokens, so they re-resolve on a theme flip', () => {
    mount();
    expect(column(1)[0].style.color).toBe('var(--hot-4-ink)');
    expect(column(2)[0].style.color).toBe('var(--cold-4-ink)');
    expect(column(13)[0].style.color).toBe('var(--accent-ink)');
    for (const n of [14, 15, 16]) expect(column(n)[0].style.color).toBe('var(--ui-muted)');
    // The fill siblings the original wrote into `color:` must be gone from every cell.
    const fills = ['--hot-4)', '--cold-4)', '--color-accent)', '--hot-3)', '--cold-3)'];
    const styles = qa('#tbl td').map((td) => td.getAttribute('style') ?? '');
    for (const f of fills) expect(styles.filter((s) => s.includes(f)), f).toEqual([]);
  });

  test('slope is inked hot when positive and COLD WHEN ZERO, which is the original ternary having no branch for zero', () => {
    mount();
    const zero = CITIES.filter((c) => c.slope === 0);
    expect(zero.length).toBe(1); // if the data changes, this test is telling you so
    const colour = new Map(bodyRows().map((r) => [r.dataset.c, (r.children[11] as HTMLElement).style.color]));
    for (const c of CITIES) {
      expect(colour.get(c.city), c.city).toBe(c.slope > 0 ? 'var(--hot-3-ink)' : 'var(--cold-3-ink)');
    }
    expect(colour.get(zero[0].city)).toBe('var(--cold-3-ink)');
  });

  test('the suhii column interpolates the hot INK ramp from src/map/ink.ts and not a copy of its own', async () => {
    const user = userEvent.setup();
    for (const theme of ['nocturne', 'modernist'] as const) {
      /* The PERSISTED key, not the DOM attribute: `ThemeProvider` initialises from
       * localStorage (ruling 6) and writes the attribute itself, so setting the attribute
       * alone left the component on nocturne and the modernist half of this loop passed
       * against nocturne's hexes. */
      cleanup();
      window.localStorage.setItem('suhi.theme', theme);
      mount();
      expect(document.documentElement.dataset.theme, 'the provider must have taken the theme').toBe(theme);
      const tokens = ink(theme);
      // The ramp read as text: d3's own interpolation over the five -ink stops, computed here
      // from INK_TOKENS - the SAME derivation src/styles/ink.css is generated from - so a
      // second interpolation written inside Table.tsx would disagree with this.
      const { scaleLinear } = await import('d3');
      const expected = scaleLinear()
        .domain([0, 0.9, 1.8, 2.7, 3.7])
        .range(['--hot-1-ink', '--hot-2-ink', '--hot-3-ink', '--hot-4-ink', '--hot-5-ink'].map((t) => tokens[t]))
        .clamp(true);
      const colour = new Map(bodyRows().map((r) => [r.dataset.c, (r.children[3] as HTMLElement).style.color]));
      for (const c of CITIES) {
        expect(colour.get(c.city), `${c.city} in ${theme}`).toBe(rgb(expected(c.suhii) as unknown as string));
      }
      // Not a flat colour: the interpolation is the whole point of this column.
      expect(new Set(colour.values()).size).toBeGreaterThan(20);
      await user.click(heads()[0]); // leaves the suite having exercised a re-render too
    }
  });

  test('all 18 negative cities are CLAMPED to the ramp zero end rather than extrapolating off it', () => {
    window.localStorage.setItem('suhi.theme', 'nocturne');
    mount();
    const tokens = ink('nocturne');
    const colour = new Map(bodyRows().map((r) => [r.dataset.c, (r.children[3] as HTMLElement).style.color]));
    const negatives = CITIES.filter((c) => c.suhii < 0);
    expect(negatives.length).toBe(18);
    for (const c of negatives) expect(colour.get(c.city), c.city).toBe(rgb(tokens['--hot-1-ink']));
  });
});

/** jsdom serialises an inline `color` as rgb(); the expectations above are hexes. */
function rgb(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex.trim().replace(/,\s*/g, ', ');
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

describe('sorting', () => {
  test('the default sort is suhii descending, as the original module variables are', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'suhii', dir: -1 });
    mount();
    const suhii = bodyRows().map((r) => CITIES.find((c) => c.city === r.dataset.c)!.suhii);
    expect(suhii).toEqual([...suhii].sort((a, b) => b - a));
    expect(suhii[0]).toBe(Math.max(...CITIES.map((c) => c.suhii)));
    expect(heads()[3].textContent).toBe('SUHI °C ↓');
    expect(heads()[3].getAttribute('aria-sort')).toBe('descending');
  });

  test('sorts numerically on a numeric column and lexically on a string column', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(heads()[6]); // pop_hot
    const pop = bodyRows().map((r) => CITIES.find((c) => c.city === r.dataset.c)!.pop_hot);
    expect(pop).toEqual([...pop].sort((a, b) => b - a));
    // Lexical, not numeric: a numeric subtraction on strings yields NaN and leaves the input
    // order untouched, which is what this would catch.
    await user.click(heads()[14]); // landcover
    const lc = bodyRows().map((r) => CITIES.find((c) => c.city === r.dataset.c)!.landcover);
    expect(lc).toEqual([...lc].sort((a, b) => a.localeCompare(b)));
    expect(new Set(lc).size).toBeGreaterThan(1);
  });

  test('a string column sorts A-Z at the SAME sortDir that makes a numeric column descend, because the original negates dir in the string branch only', () => {
    // dir === -1 is the default. Numeric descends; string ascends. The asymmetry is the
    // behaviour, and a reader "fixing" it would silently reverse four of the seventeen columns.
    expect(sortCities(CITIES, 'suhii', -1).map((c) => c.suhii)[0]).toBe(Math.max(...CITIES.map((c) => c.suhii)));
    const names = sortCities(CITIES, 'city', -1).map((c) => c.city);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0]).toBe([...names].sort((a, b) => a.localeCompare(b))[0]);
    // And at dir === +1 both invert.
    expect(sortCities(CITIES, 'suhii', 1).map((c) => c.suhii)[0]).toBe(Math.min(...CITIES.map((c) => c.suhii)));
    expect(sortCities(CITIES, 'city', 1).map((c) => c.city)).toEqual([...names].reverse());
  });

  test('clicking a sorted heading reverses the direction and a new heading starts descending', async () => {
    const user = userEvent.setup();
    mount();
    const first = cityOrder();
    const suhiiOf = (names: (string | undefined)[]) => names.map((n) => CITIES.find((c) => c.city === n)!.suhii);
    const firstValues = suhiiOf(first);
    await user.click(heads()[3]); // suhii again: flip
    /* The VALUE sequence reverses exactly; the CITY order does not, and that is not a defect.
     * `.sort` is stable, so two cities sharing a suhii keep source order in both directions -
     * asserting `cityOrder().reverse()` failed on four such pairs. */
    expect(suhiiOf(cityOrder())).toEqual([...firstValues].reverse());
    expect(heads()[3].textContent).toBe('SUHI °C ↑');
    expect(heads()[3].getAttribute('aria-sort')).toBe('ascending');
    await user.click(heads()[3]); // and back
    expect(cityOrder()).toEqual(first);
    expect(heads()[3].textContent).toBe('SUHI °C ↓');

    // A DIFFERENT heading resets dir to -1 rather than keeping the current one.
    await user.click(heads()[3]); // suhii ascending
    await user.click(heads()[12]); // hotdays - must come out descending, not ascending
    const hd = bodyRows().map((r) => CITIES.find((c) => c.city === r.dataset.c)!.hotdays);
    expect(hd).toEqual([...hd].sort((a, b) => b - a));
    expect(heads()[12].textContent).toBe('Hot days ↓');
    expect(nextSort({ key: 'suhii', dir: 1 }, 'hotdays')).toEqual({ key: 'hotdays', dir: -1 });
    expect(nextSort({ key: 'suhii', dir: -1 }, 'suhii')).toEqual({ key: 'suhii', dir: 1 });
  });

  test('exactly one heading carries an arrow, and it is the sorted one', async () => {
    const user = userEvent.setup();
    mount();
    for (const n of [0, 6, 11, 16]) {
      await user.click(heads()[n]);
      const arrowed = heads().filter((th) => /[↑↓]/.test(th.textContent ?? ''));
      expect(arrowed).toHaveLength(1);
      expect(arrowed[0].dataset.k).toBe(KEYS[n]);
      expect(heads().filter((th) => th.getAttribute('aria-sort') !== 'none')).toHaveLength(1);
    }
  });

  test('sorting never mutates the source array', () => {
    const before = CITIES.map((c) => c.city);
    sortCities(CITIES, 'city', 1);
    sortCities(CITIES, 'suhii', -1);
    expect(CITIES.map((c) => c.city)).toEqual(before);
  });
});

describe('the clickable row', () => {
  test('a row is a <tr> with a keyboard affordance, NOT a div role=button and not cells wrapped in buttons (ruling 42 meets table.dt td)', () => {
    mount();
    const row = bodyRows()[0];
    expect(row.tagName).toBe('TR');
    expect(row.getAttribute('role')).toBeNull();
    expect(row.tabIndex).toBe(0);
    expect(row.getAttribute('aria-label')).toContain('open on the map');
    // A nested button inside a 6px/10px cell would take UA padding, font and background.
    expect(qa('#tbl td button')).toEqual([]);
    expect(qa('#tbl th button')).toEqual([]);
    expect(heads()[0].tabIndex).toBe(0);
  });

  test('clicking a row calls back with that city, and Enter and Space do the same', async () => {
    const user = userEvent.setup();
    const onOpenCity = vi.fn();
    mount(FIXTURE, onOpenCity);
    const row = bodyRows()[3];
    const name = row.dataset.c!;
    await user.click(row);
    expect(onOpenCity).toHaveBeenCalledWith(name);
    row.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onOpenCity).toHaveBeenCalledTimes(3);
    expect(onOpenCity.mock.calls.every((c) => c[0] === name)).toBe(true);
  });

  test('clicking a row switches to the map tab and focuses that city', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App data={FIXTURE} />
      </StrictMode>,
    );
    await user.click(screen.getByRole('tab', { name: 'Data table' }));
    expect(document.getElementById('panel-table')!.dataset.on).toBe('true');
    const row = qa('#panel-table #tbl tbody tr')[0];
    const name = row.dataset.c!;
    await user.click(row);
    // selectTab('map') AND focusCity(name), prototype line 1130 - both halves asserted.
    expect(screen.getByRole('tab', { name: 'Map' }).getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('panel-table')!.dataset.on).toBe('false');
    const drawer = document.getElementById('drawer')!;
    expect(drawer.dataset.open).toBe('true');
    expect(drawer.querySelector('h3')?.textContent).toBe(name);
  });
});
