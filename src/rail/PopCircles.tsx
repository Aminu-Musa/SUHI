/* Rail group 8 - the population-circle controls and their nested-circle legend. Markup from
 * prototype lines 317-327, `popScale` from 746-751, `renderPopLegend` from 778-790.
 *
 * TWO INDEPENDENT SEGMENTS, which is easy to mistake for one. `#metricSeg` chooses WHAT the
 * circle area encodes (`state.circleMetric`: population affected / spot area) and `#popSeg`
 * chooses WHICH circles are drawn (`state.popMode`: both / hot / cold). They are separate state
 * fields with separate handlers (lines 978-983) and neither resets the other - picking "Hot"
 * must not quietly send the metric back to population. PopCircles.test.tsx pins that.
 *
 * ONE SHARED SQRT SCALE, over a domain taken from BOTH the hot and the cold field
 * (`Math.max(c[fh], c[fc])`), so a hot circle and a cold circle of equal area mean equal
 * population. That is the whole point of a proportional-symbol map, and it is why the domain is
 * not computed per class. `scaleSqrt` - not `scaleLinear` - because the eye reads AREA, so the
 * radius has to be the square root of the value. Range `[3, 22]` px.
 *
 * `|| 1` on the domain maximum (line 750) is load-bearing: `max([])` is `undefined`, and a
 * `[0, undefined]` domain makes every radius NaN, which would write `r="NaN"` into three
 * `<circle>`s. Reachable here before the fetch lands.
 *
 * THE LEGEND'S THREE VALUES ARE HARD-CODED (line 780), not quantiles: [500, 5 000, 23 000]
 * persons, or [25, 150, 600] km². They are round numbers chosen to sit inside the data's range
 * (the real maxima are 30 653 persons and 422.36 km²), so the 600 km² circle is drawn LARGER
 * than anything on the map. Transcribed, not corrected.
 *
 * The geometry is the original's arithmetic, kept as arithmetic rather than rounded: the SVG is
 * `max*2 + 22` tall on a fixed `0 0 240 …` viewBox at `width:100%`, so the drawing scales with
 * the rail while the circles keep their ratios. Circles sit at `cx = 24 + i*74`, baselines at
 * `y = max*2 + 16`.
 *
 * `cssv('--ui-muted')` resolved the token to a literal rgb() before writing it into the markup.
 * Here the var() goes in through `style`, not through the `stroke`/`fill` presentation
 * attribute: identical colour, and it re-resolves on a theme change without a re-render, which
 * the baked literal did not.
 */

import { Fragment } from 'react';
import { format, max, scaleSqrt } from 'd3';
import { useT } from '../app/I18nProvider';
import type { City } from '../app/data';
import { useAppState, type CircleMetric, type PopMode } from '../app/state';
import { Seg } from './Seg';

/** Prototype line 746. */
export const CIRCLE_FIELD = {
  pop: ['pop_hot', 'pop_cold'],
  area: ['area_hot', 'area_cold'],
} as const satisfies Record<CircleMetric, readonly [keyof City, keyof City]>;

/** Prototype line 780. */
export const LEGEND_VALUES = {
  pop: [500, 5000, 23000],
  area: [25, 150, 600],
} as const satisfies Record<CircleMetric, readonly [number, number, number]>;

/** Prototype lines 747-751. Exported so the test asserts the scale, not a re-derivation. */
export function popScale(cities: readonly City[], metric: CircleMetric): (v: number) => number {
  const [fh, fc] = CIRCLE_FIELD[metric];
  const m = max(cities, (c) => Math.max(c[fh] as number, c[fc] as number)) || 1;
  return scaleSqrt().domain([0, m]).range([3, 22]);
}

const METRIC_OPTIONS = [
  { value: 'pop', i18n: 'metric_pop' },
  { value: 'area', i18n: 'metric_area' },
] as const;

/* The static markup reads "Hot" / "Cold" but carries `data-i18n="hotspots"` / `"coldspots"`,
 * and `applyI18n` overwrote the text with the dictionary value at boot (prototype line 550).
 * So the rendered truth in all four languages is "Hot spots" / "Cold spots"; the shorter words
 * in the file were never on screen. */
const POP_OPTIONS = [
  { value: 'both', i18n: 'both' },
  { value: 'hot', i18n: 'hotspots' },
  { value: 'cold', i18n: 'coldspots' },
] as const;

export function PopCircles({ cities }: { readonly cities: readonly City[] }) {
  const t = useT();
  const [state, patch] = useAppState();

  const rad = popScale(cities, state.circleMetric);
  const vals = LEGEND_VALUES[state.circleMetric];
  const unit = state.circleMetric === 'pop' ? '' : ' km²';
  const biggest = rad(vals[2]);
  const height = biggest * 2 + 22;

  return (
    <div>
      <div className="sec-h">
        <span data-i18n="pop_circles">{t('pop_circles')}</span>
      </div>
      <Seg
        id="metricSeg"
        style={{ marginBottom: '4px' }}
        options={METRIC_OPTIONS.map((o) => ({ value: o.value, label: t(o.i18n) }))}
        value={state.circleMetric}
        onChange={(v) => patch({ circleMetric: v as CircleMetric })}
      />
      <Seg
        id="popSeg"
        options={POP_OPTIONS.map((o) => ({ value: o.value, label: t(o.i18n) }))}
        value={state.popMode}
        onChange={(v) => patch({ popMode: v as PopMode })}
      />
      <div id="popLegend" style={{ marginTop: 'var(--space-3)' }}>
        <svg width="100%" height={height} viewBox={`0 0 240 ${height}`}>
          {vals.map((v, i) => {
            const r = rad(v);
            const cx = 24 + i * 74;
            return (
              /* A keyed Fragment rather than a <g>: the original emitted circle and text as
               * siblings directly under the <svg>, and a wrapper would be a markup difference
               * for nothing. */
              <Fragment key={v}>
                <circle cx={cx} cy={biggest + 2} r={r} fill="none" style={{ stroke: 'var(--ui-muted)' }} />
                <text
                  x={cx}
                  y={biggest * 2 + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  style={{ fill: 'var(--ui-muted)' }}
                >
                  {format(',')(v)}
                  {unit}
                </text>
              </Fragment>
            );
          })}
        </svg>
        <p className="note" style={{ margin: '2px 0 0' }} data-i18n="pop_circles_note">
          {t('pop_circles_note')}
        </p>
      </div>
    </div>
  );
}
