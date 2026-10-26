/* The Data table tab. `renderTable()`, prototype lines 1105-1130, transcribed.
 *
 * ALL SEVENTEEN COLUMNS, in the original's order. Revision 1 showed seven by default behind a
 * "more columns" toggle and spec §7.6 reverts it. The measured problem revision 1 was solving
 * was real - seventeen columns want about 1,592px - but it was measured inside the 585px the
 * panel has while the 332px rail shares its row, and on THIS tab the rail is `display:none`
 * (ruling 5), so the panel is the whole window. `.panel` declares `overflow-y:auto` and nothing
 * for x, and CSS computes the other axis of a non-visible overflow to `auto`, so the panel
 * scrolls sideways on a narrow window. That is what the original does, with no rule of its own.
 *
 * WHY THIS IS NOT TANSTACK TABLE, although @tanstack/react-table is a dependency and the plan
 * named it. The sort it has to reproduce is three lines (prototype 1114-1115) and one of those
 * lines is a deliberate asymmetry:
 *
 *     typeof a[k] === 'string' ? a[k].localeCompare(b[k]) * -sortDir : (a[k] - b[k]) * sortDir
 *
 * The STRING branch is multiplied by MINUS `sortDir`. So at the default `sortDir === -1` the
 * numeric columns sort descending (largest first) and `city`, `landcover`, `elev` and `geol`
 * sort A-Z - and one click on a string heading, which flips `sortDir` to +1, turns A-Z into
 * Z-A while turning every numeric column ascending. Direction does not mean the same thing in
 * the two branches. Driving that through a sorting model built on asc/desc per column means a
 * custom `sortingFn` AND an inversion of the library's own direction semantics for four of the
 * seventeen columns - more code than `sortCities` below, and code whose bug would be invisible.
 * `useTable` v9 is a feature-plugin API on top of that. The library earns its place when a
 * table needs pagination, grouping, virtualisation or column sizing; this one needs `.sort()`.
 * Pinned by `sortCities` tests that assert the asymmetry directly.
 *
 * THE INK SCALE HAS ONE OWNER. `suhii` is the CONTINUOUS ramp read as TEXT at 12px - the usage
 * that forced the ink scale into existence (spec §5.3) - so its colour comes from
 * `hotInkScale`, imported from src/map/ink.ts exactly as Compare.tsx imports it. Two tabs each
 * interpolating their own copy is how they come to disagree about the colour of one number.
 * The other coloured columns are STATIC tokens and go into the DOM as `var(--…-ink)`, so they
 * re-resolve on a theme flip with no re-render at all.
 *
 * RULING 42 AND THE CLICKABLE ROW. The ruling says a clickable row is a `div` with
 * `role="button"`, because `.rw` and friends declare a font-size and no font-family or
 * background and a UA button would repaint them. A table row cannot take that shape: it is a
 * `<tr>` because its children are `<td>`s that `table.dt td` gives padding and alignment to,
 * and the original makes the whole row clickable with `table.dt tbody tr { cursor: pointer }`.
 * Wrapping the cells in buttons would put a UA-styled inline-block inside each 6px/10px cell.
 * So the row stays a `<tr>` with role="row" and gains the affordances a clickable thing needs
 * without changing its box: `tabIndex`, Enter and Space, and an `aria-label` saying what the
 * click does. `aria-sort`, `scope` and `tabIndex` on the headings are the same trade - the
 * original bound `th.onclick` and offered the keyboard nothing.
 */

import { useCallback, useMemo, useState } from 'react';
import { useT } from '../app/I18nProvider';
import { useTheme } from '../app/ThemeProvider';
import type { City, SuhiData } from '../app/data';
import { fmt } from '../rail/stats';
import { hotInkScale } from '../map/ink';

/** The seventeen sortable keys, in the original's column order (prototype lines 1106-1111). */
export type ColKey =
  | 'city' | 'hot' | 'cold' | 'suhii' | 'mean_lst' | 'max_lst' | 'pop_hot' | 'pop_cold'
  | 'area_hot' | 'pct_hot' | 'area_cold' | 'slope' | 'hotdays' | 'cluster' | 'landcover'
  | 'elev' | 'geol';

/** A column's heading. `tk` is a dictionary key; `lit` is a literal the original did not
 * translate (`'SUHI °C'`, `'°C/dec'`); `pct` is line 1109's `'% ' + T('hot')`. */
interface Col {
  readonly k: ColKey;
  readonly tk?: string;
  readonly lit?: string;
  readonly pct?: true;
}

export const COLS: readonly Col[] = [
  { k: 'city', tk: 'city' },
  { k: 'hot', tk: 'hot' },
  { k: 'cold', tk: 'cold' },
  { k: 'suhii', lit: 'SUHI °C' },
  { k: 'mean_lst', tk: 'mean_lst' },
  { k: 'max_lst', tk: 'max_lst' },
  { k: 'pop_hot', tk: 'pop_in_hot' },
  { k: 'pop_cold', tk: 'pop_in_cold' },
  { k: 'area_hot', tk: 'hot_area' },
  { k: 'pct_hot', pct: true },
  { k: 'area_cold', tk: 'cold_area' },
  { k: 'slope', lit: '°C/dec' },
  { k: 'hotdays', tk: 'hotdays' },
  { k: 'cluster', tk: 'cluster' },
  { k: 'landcover', tk: 'landcover' },
  { k: 'elev', tk: 'elevation' },
  { k: 'geol', tk: 'geology' },
];

/** Prototype line 1112: `sortKey='suhii', sortDir=-1`. */
export const DEFAULT_SORT: { readonly key: ColKey; readonly dir: 1 | -1 } = { key: 'suhii', dir: -1 };

/**
 * Prototype lines 1114-1115, verbatim in behaviour.
 *
 * `typeof a[key] === 'string'` is tested PER COMPARISON on the first operand, as the original
 * tests it, rather than from a column declaration - with these seventeen keys the two always
 * agree (cities.json has no mixed-type column; checked across all 55 rows), and transcribing
 * the test keeps the asymmetry below visible instead of hiding it in a table of flags.
 *
 * THE STRING BRANCH NEGATES `dir`. See the header note: this is not a bug to tidy. It is why
 * the default `dir: -1` puts Akure's 3.66 °C at the top of `suhii` and Abeokuta at the top of
 * `city` in the same breath.
 */
export function sortCities(cities: readonly City[], key: ColKey, dir: 1 | -1): City[] {
  return [...cities].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    return typeof x === 'string'
      ? x.localeCompare(y as string) * -dir
      : ((x as number) - (y as number)) * dir;
  });
}

/** Prototype lines 1128-1129: the same key flips direction, a new key starts at -1. */
export function nextSort(
  current: { key: ColKey; dir: 1 | -1 },
  clicked: ColKey,
): { key: ColKey; dir: 1 | -1 } {
  return current.key === clicked
    ? { key: clicked, dir: (current.dir * -1) as 1 | -1 }
    : { key: clicked, dir: -1 };
}

export interface TableProps {
  readonly data: SuhiData | null;
  /**
   * Prototype line 1130: `selectTab('map'); focusCity(tr.dataset.c)` - BOTH, in that order.
   * Injected rather than reached for, because the tab value lives in `Shell`'s `useState` and
   * `focusCity` in the interactions context, and no component below this one holds both.
   */
  readonly onOpenCity?: (city: string) => void;
}

export function Table({ data, onOpenCity }: TableProps) {
  const t = useT();
  const { theme } = useTheme();
  const [sort, setSort] = useState(DEFAULT_SORT);

  const cities = data?.cities ?? [];
  const rows = useMemo(() => sortCities(cities, sort.key, sort.dir), [cities, sort.key, sort.dir]);

  /* One scale per render, not one per cell: `hotInkScale` derives eleven OKLCH walks on a cold
   * memo, and the table draws 55 `suhii` cells. */
  const suhiInk = useMemo(() => hotInkScale(theme), [theme]);

  const onSort = useCallback((k: ColKey) => setSort((s) => nextSort(s, k)), []);

  const label = (c: Col): string => (c.pct ? `% ${t('hot')}` : (c.lit ?? t(c.tk as string)));

  return (
    <table className="dt" id="tbl">
      <thead>
        <tr>
          {COLS.map((c) => (
            <th
              key={c.k}
              data-k={c.k}
              scope="col"
              tabIndex={0}
              aria-sort={sort.key === c.k ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none'}
              onClick={() => onSort(c.k)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSort(c.k);
                }
              }}
            >
              {/* Line 1113's arrow, appended to the label inside the same `th` with the same
                * leading space, so the heading's text and its width are the original's. */}
              {`${label(c)}${sort.key === c.k ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <Row key={c.city} city={c} suhiInk={suhiInk} onOpen={onOpenCity} />
        ))}
      </tbody>
    </table>
  );
}

function Row({
  city: c,
  suhiInk,
  onOpen,
}: {
  readonly city: City;
  readonly suhiInk: (v: number) => string;
  readonly onOpen?: (city: string) => void;
}) {
  const open = () => onOpen?.(c.city);
  return (
    <tr
      data-c={c.city}
      tabIndex={0}
      aria-label={`${c.city} — open on the map`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <td>{c.city}</td>
      {/* §5.4: the three fill tokens the original wrote into `color:` here are 12px TEXT, so
        * they become their ink siblings. Static, so they stay `var()` and survive a theme flip
        * without a render. */}
      <td style={{ color: 'var(--hot-4-ink)' }}>{c.hot}</td>
      <td style={{ color: 'var(--cold-4-ink)' }}>{c.cold}</td>
      {/* THE INTERPOLATED CASE, and the only one on this tab. §9.1 bug 11 does NOT apply:
        * line 1117 already writes `c.suhii > 0 ? '+' : ''`, unlike the three places that wrote
        * a bare `+` and produced `+-0.66`. Transcribed as it stands. */}
      <td style={{ color: suhiInk(c.suhii) }}>{`${c.suhii > 0 ? '+' : ''}${c.suhii}`}</td>
      <td>{fmt(c.mean_lst, 1)}</td>
      <td>{fmt(c.max_lst, 1)}</td>
      <td>{fmt(c.pop_hot)}</td>
      <td>{fmt(c.pop_cold)}</td>
      <td>{fmt(c.area_hot, 0)}</td>
      {/* `pct_hot`, `hot`, `cold`, `hotdays` and `cluster` do NOT go through `fmt` in the
        * original, so a thousands separator never appears on them and `pct_hot` keeps its own
        * precision (3, 2.16, …). Transcribed, not normalised. */}
      <td>{c.pct_hot}</td>
      <td>{fmt(c.area_cold, 0)}</td>
      {/* `slope > 0 ? hot-3 : cold-3` is the original's ternary, with no branch for zero - so
        * the one city whose decadal slope is exactly 0.0 is inked COLD. Transcribed rather than
        * corrected: it is a visual the approved page makes, and `>= 0` would move a row. */}
      <td style={{ color: c.slope > 0 ? 'var(--hot-3-ink)' : 'var(--cold-3-ink)' }}>
        {`${c.slope > 0 ? '+' : ''}${c.slope}`}
      </td>
      <td>{c.hotdays}</td>
      {/* `--color-accent` is 12px text here, so §5.4 moves it to `--accent-ink` as it moves
        * Compare's cluster note. */}
      <td style={{ color: 'var(--accent-ink)' }}>{c.cluster}</td>
      <td style={{ color: 'var(--ui-muted)' }}>{c.landcover}</td>
      <td style={{ color: 'var(--ui-muted)' }}>{c.elev}</td>
      <td style={{ color: 'var(--ui-muted)' }}>{c.geol}</td>
    </tr>
  );
}
