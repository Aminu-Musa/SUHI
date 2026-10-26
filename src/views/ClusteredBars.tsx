/* Spec §7.5's ONE change to Compare: a `.cbar` row that carries TWO bars, day against night.
 *
 * Everything around the change is the original's. The row is still `.cbar` - the same
 * `92px 1fr 62px` grid, the same 11.5px type, the same `.t` / `.track` / `.v` children, the same
 * `--color-neutral-400` track and the same track-anchored gradients (`--hot-2` -> `--hot-5`, or
 * `--cold-4` -> `--cold-2` for a cold measure). What changes is that the track and value columns
 * each appear twice, on two grid rows, with the label spanning both.
 *
 * THE MEASURE TABLE IS TRANSCRIBED, prototype lines 1078-1084, including the order and including
 * which two measures read on the COLD ramp (`pop_in_cold` and `cold_area`). The i18n key, the
 * data key, the unit, the decimal count and the ramp are all the original's.
 *
 * `.cbar .v` IS NOT COLOURED (ruling 8). It is a bare `<span class="v">` inheriting
 * `--color-text` in the original, and it stays one here. The ramp-coloured text in Compare is the
 * per-card SUHI figure, the cluster note and the footer trio - see Compare.tsx.
 *
 * WHY THE DAY AND NIGHT BARS DIFFER ONLY IN OPACITY. §7.5 fixes the fill: both bars keep the
 * original's gradient for their measure's ramp, so hue, saturation and direction are all spoken
 * for and opacity is the only free variable left. The night bar is the same gradient at 55%, and
 * the panel carries one legend saying which is which, because a clustered bar chart with no key
 * is a chart you cannot read. There is no established day/night colour in this dashboard to
 * borrow: the night map uses the same ramp as the day map, and the swipe tells them apart by
 * position and a text tag rather than by palette.
 */

import type { CityPeriod } from '../app/data';
import { fmt } from '../rail/stats';

/** Which ramp a measure reads on. Prototype lines 1078-1084's fifth tuple element. */
export type Ramp = 'hot' | 'cold';

/** The nine data keys the measure table draws, enumerated rather than left as `keyof CityPeriod`
 * so the type carries "this is a NUMBER a bar can be scaled from": `city` and `period` are keys
 * of that row too, and `Math.abs('Ibadan')` is not a bar length. */
export type MeasureKey =
  | 'suhii' | 'mean_lst' | 'max_lst' | 'pop_hot' | 'pop_cold'
  | 'area_hot' | 'pct_hot' | 'area_cold' | 'slope';

export interface Measure {
  /** i18n key for the 92px label column. */
  readonly tk: string;
  /** Key into a city row - the same name in `City` and in `CityPeriod`. */
  readonly k: MeasureKey;
  /** Appended to the figure after a space, or nothing when empty. */
  readonly unit: string;
  /** Decimals for `fmt`. */
  readonly d: number;
  readonly ramp: Ramp;
}

/** Prototype lines 1078-1084, in order. Nine measures, two of them cold. */
export const MEASURES: readonly Measure[] = [
  { tk: 'suhi_int', k: 'suhii', unit: '°C', d: 1, ramp: 'hot' },
  { tk: 'mean_lst', k: 'mean_lst', unit: '°C', d: 1, ramp: 'hot' },
  { tk: 'max_lst', k: 'max_lst', unit: '°C', d: 1, ramp: 'hot' },
  { tk: 'pop_in_hot', k: 'pop_hot', unit: '', d: 0, ramp: 'hot' },
  { tk: 'pop_in_cold', k: 'pop_cold', unit: '', d: 0, ramp: 'cold' },
  { tk: 'hot_area', k: 'area_hot', unit: 'km²', d: 0, ramp: 'hot' },
  { tk: 'hot_share', k: 'pct_hot', unit: '%', d: 2, ramp: 'hot' },
  { tk: 'cold_area', k: 'area_cold', unit: 'km²', d: 0, ramp: 'cold' },
  { tk: 'warming', k: 'slope', unit: '°C/dec', d: 2, ramp: 'hot' },
];

/** Prototype line 1087's two gradients, verbatim. A bar is a FILL, so these stay on the plain
 * ramp tokens; only ramp-coloured TEXT moves to the -ink scale (spec §5.4). */
export const RAMP_FILL: Readonly<Record<Ramp, string>> = {
  hot: 'linear-gradient(90deg,var(--hot-2),var(--hot-5))',
  cold: 'linear-gradient(90deg,var(--cold-4),var(--cold-2))',
};

/** The two bars, in the order they are drawn on every card. */
export const PERIODS: readonly ('day' | 'night')[] = ['day', 'night'];

/**
 * NATIONAL-MAXIMUM SCALING, and the one place §7.5 forces the formula to move.
 *
 * The original is `d3.max(CITIES, x => Math.abs(x[k]))` (prototype line 1086) - the largest
 * absolute value of this measure anywhere in Nigeria, so a bar's length means the same thing on
 * every card and the lede's promise holds: "lengths compare down a column but not across them".
 * Rescaling to the selected cities was a revision-1 change the spec reverts, and this does NOT
 * do it: the denominator still has nothing to do with which cities are picked.
 *
 * What moved is the TABLE the maximum is taken over. The bars now draw PER-PERIOD figures, and a
 * pooled mean sits between a city's day and its night, so a day figure routinely exceeds the
 * largest pooled figure in the country. Measured on the shipped data: against
 * `d3.max(CITIES, …)`, 19 of the 954 bars exceed 100% - `suhii` 10 (Akure's day is 3.66 against
 * a pooled national maximum of 2.34), `slope` 6, `mean_lst` 3 - and `overflow:hidden` on
 * `.cbar .track` would silently clip every one of them to a full track. Ibadan's 3.43 and Ife's
 * 3.19 would be drawn identically, which is precisely the comparison the lede promises.
 *
 * So the maximum is taken over the per-period table - the national maximum OF THE MEASURE BEING
 * DRAWN. Every column still has exactly one full bar, held by the national record-holder, and
 * nothing is clipped. `|| 1` is the original's own guard against a measure that is zero
 * everywhere dividing by zero.
 */
export function nationalMax(rows: readonly CityPeriod[], k: MeasureKey): number {
  let most = 0;
  for (const r of rows) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) most = Math.max(most, Math.abs(v));
  }
  return most || 1;
}

/** `fmt(c[k], d)` plus the unit, prototype line 1088. A null reads as an em dash with NO unit:
 * "— °C" claims a reading in degrees that does not exist. Bida's night has no LST at all. */
export function figure(v: number | null | undefined, m: Measure): string {
  if (v == null) return fmt(null);
  return m.unit ? `${fmt(v, m.d)} ${m.unit}` : fmt(v, m.d);
}

export interface ClusteredBarProps {
  readonly label: string;
  readonly measure: Measure;
  /** The city's day and night rows, either of which may be missing (four cities are
   * single-period in spots.geojson). */
  readonly rows: Readonly<Partial<Record<'day' | 'night', CityPeriod>>>;
  readonly max: number;
  /** Period name per bar, for the screen-reader label and the `title`. */
  readonly periodLabel: Readonly<Record<'day' | 'night', string>>;
}

/** One measure: label, two tracks, two figures. */
export function ClusteredBar({ label, measure, rows, max, periodLabel }: ClusteredBarProps) {
  return (
    <div className="cbar cbar-dn">
      <span className="t">{label}</span>
      {PERIODS.map((p) => {
        const v = rows[p]?.[measure.k];
        const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
        return (
          /* The `<i>` is OMITTED, not given width 0, when there is no figure. A zero-width bar
           * and a bar that is genuinely zero are different claims, and `pop_cold` really is 0
           * for 20-odd cities - so the absent case has to be absent. */
          <span className="track" key={p} data-period={p} title={`${periodLabel[p]} · ${label}`}>
            {n === null ? null : (
              <i style={{ width: `${(Math.abs(n) / max) * 100}%`, background: RAMP_FILL[measure.ramp] }} />
            )}
          </span>
        );
      })}
      {PERIODS.map((p) => (
        <span className="v" key={p} data-period={p}>
          {figure(rows[p]?.[measure.k], measure)}
        </span>
      ))}
    </div>
  );
}
