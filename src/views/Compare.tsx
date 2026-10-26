/* The Compare tab. `renderCompare()`, prototype lines 1071-1102, with spec §7.5's one change:
 * each `.cbar` row carries two bars, day against night (see ClusteredBars.tsx).
 *
 * WHAT IS DELIBERATELY UNCHANGED, because revision 1 changed all of it and the spec reverts
 * every one: the picker is capped at FIVE cities (`picked.length < 5`, line 1076) and not four;
 * `.cmp` is the `auto-fit minmax(240px, 1fr)` grid and not a matrix; one `.card2` per city; the
 * nine measures in the original's order; and the scale is the NATIONAL maximum, never the
 * selected set.
 *
 * `picked` IS LOCAL STATE, not app state, and that is the original's own scope: a module-level
 * `let picked` (line 1070) that nothing else reads and nothing persists. The panel is mounted on
 * every tab - `.panel` is hidden with `display:none`, never unmounted (ruling 5) - so a local
 * `useState` survives a trip to the map and back exactly as the module variable did.
 *
 * `.pk` STAYS A REAL `<button>`. Ruling 42 says a clickable ROW is a `div` with `role="button"`,
 * because `.rw` and friends declare a font-size and no font-family or background and a UA button
 * would repaint them. `.pk` is the opposite case: it is a `<button>` in the original, its CSS
 * (`background:none`, its own font-size, `border`, `border-radius`) is written against a button,
 * and `aria-pressed` is already there. Swapping it would be the change, not the fidelity.
 *
 * THE ONE ELEMENT THAT IS NOT IN THE ORIGINAL is `#cmpLegend`, a `.note` between the lede and
 * the picker saying which bar is day and which is night. §7.5 doubles the bars and fixes their
 * fill, so the only thing left to tell them apart is opacity, and an opacity difference with no
 * key is not readable. It is one `.note`, the class the panel already uses twice per card.
 *
 * THE HEADER FIGURE IS `+${c.suhii} °C` LITERALLY, sign and all - see the comment at the call
 * site. Eighteen of the 55 cities have a negative pooled SUHI, Maiduguri among the four the
 * picker starts with, so the original really does print "+-0.66 °C" there. Transcribed rather
 * than corrected: §9.1 does not list it, and the original is the visual authority.
 */

import { useMemo, useState } from 'react';
import { useT } from '../app/I18nProvider';
import { useTheme } from '../app/ThemeProvider';
import type { City, Cluster, SuhiData } from '../app/data';
/* RULING 32's ink scale, imported rather than re-derived. src/map/ink.ts is Task 7's and it is
 * NOT map-private despite the folder: it already reaches into src/rail/stats for `spotValue`,
 * and its subject is the ramp read as text, which is a theme concern rather than a map one. The
 * whole point of the ruling is that there is ONE definition - three consumers each interpolating
 * separately is how two tabs come to disagree about the colour of the same number - so this
 * imports it where it lives instead of moving a file Task 7 owns. */
import { hotInkScale } from '../map/ink';
import { ClusteredBar, MEASURES, PERIODS, RAMP_FILL, nationalMax } from './ClusteredBars';

/** Prototype line 1070. Four cities, and the cap is five. */
export const DEFAULT_PICKED: readonly string[] = ['Ibadan', 'Lagos', 'Kano', 'Maiduguri'];

/** Prototype line 1076, the whole of it. A picked city toggles off; an unpicked one is added
 * ONLY while fewer than five are picked, so the sixth click does nothing at all. */
export function togglePicked(picked: readonly string[], city: string): readonly string[] {
  if (picked.includes(city)) return picked.filter((x) => x !== city);
  return picked.length < 5 ? [...picked, city] : picked;
}

export interface CompareProps {
  readonly data: SuhiData | null;
  /** Test/composition seam only. The original has no way to seed `picked`. */
  readonly initialPicked?: readonly string[];
}

export function Compare({ data, initialPicked = DEFAULT_PICKED }: CompareProps) {
  const t = useT();
  const [picked, setPicked] = useState<readonly string[]>(initialPicked);

  const cities = data?.cities ?? [];
  const byPeriod = data?.citiesByPeriod ?? [];

  /* One pass over 106 rows instead of 954 scans: `${city}|${period}` is ruling 36's own key. */
  const rowsFor = useMemo(() => {
    const out = new Map<string, Partial<Record<'day' | 'night', (typeof byPeriod)[number]>>>();
    for (const r of byPeriod) {
      const got = out.get(r.city) ?? {};
      got[r.period] = r;
      out.set(r.city, got);
    }
    return out;
  }, [byPeriod]);

  /** The denominators, one per measure. See `nationalMax`: national, never per selection. */
  const maxes = useMemo(
    () => new Map(MEASURES.map((m) => [m.k, nationalMax(byPeriod, m.k)])),
    [byPeriod],
  );

  const periodLabel = { day: t('day'), night: t('night') } as const;

  /* `picked.map(find).filter(Boolean)` - PICK ORDER, not table order, exactly as line 1085 does,
   * so a card appears where the reader put it. */
  const selected = picked
    .map((name) => cities.find((c) => c.city === name))
    .filter((c): c is City => Boolean(c));

  return (
    <>
      <div className="note" id="cmpLegend">
        {PERIODS.map((p) => (
          <span key={p}>
            <i data-period={p} style={{ background: RAMP_FILL.hot }} />
            {periodLabel[p]}
          </span>
        ))}
      </div>
      <div className="picker" id="cmpPicker">
        {cities.map((c) => (
          <button
            className="pk"
            key={c.city}
            data-c={c.city}
            aria-pressed={picked.includes(c.city)}
            onClick={() => setPicked((p) => togglePicked(p, c.city))}
          >
            {c.city}
          </button>
        ))}
      </div>
      <div className="cmp" id="cmpGrid">
        {/* Prototype line 1102's `|| '<p class="note">—</p>'`: an empty selection says so
          * rather than leaving a bare grid. Reachable - the reader can unpick all five. */}
        {selected.length === 0 ? (
          <p className="note">—</p>
        ) : (
          selected.map((c) => (
            <CompareCard
              key={c.city}
              city={c}
              clusters={data?.clusters ?? []}
              rows={rowsFor.get(c.city) ?? {}}
              maxes={maxes}
              periodLabel={periodLabel}
            />
          ))
        )}
      </div>
    </>
  );
}

function CompareCard({
  city,
  clusters,
  rows,
  maxes,
  periodLabel,
}: {
  readonly city: City;
  readonly clusters: readonly Cluster[];
  readonly rows: Parameters<typeof ClusteredBar>[0]['rows'];
  readonly maxes: Map<string, number>;
  readonly periodLabel: Readonly<Record<'day' | 'night', string>>;
}) {
  const t = useT();
  const { theme } = useTheme();
  /* RULING 32 / spec §5.4. The 13px SUHI figure is the CONTINUOUS ramp read as TEXT, which is
   * the usage that forced the ink scale into existence - so it comes from `hotInkScale`, the one
   * definition, not from a second interpolation written here. */
  const suhiInk = hotInkScale(theme)(city.suhii);
  const typology = clusters.find((k) => k.id === city.cluster)?.typology ?? '';

  return (
    <div className="card2">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h4 style={{ margin: '0 0 2px', fontSize: '17px', fontFamily: 'var(--font-heading)' }}>{city.city}</h4>
        {/* §9.1 BUG 11: the original writes a bare `+` before suhii here (prototype line 1083), so a
          * negative city renders `+-0.66 °C`. A defect rather than a style, because the SAME VALUE is
          * formatted correctly elsewhere in the same application - `suhii > 0 ? '+' : ''` at prototype
          * lines 812, 861 and 886 - so the original disagrees with itself, and 18 of the 55 cities are
          * negative. Fixed in all three places that carried the bare `+`: here, the city tooltip and
          * the city drawer. */}
        <span style={{ color: suhiInk, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
          {`${city.suhii > 0 ? '+' : ''}${city.suhii} °C`}
        </span>
      </div>
      <div className="note" style={{ marginBottom: '4px' }}>
        {city.landcover} · {city.elev} · {city.geol}
      </div>
      {/* 11px `.note` in accent, so spec §5.4 moves it from `--color-accent` to `--accent-ink`:
        * it is ramp-adjacent TEXT, and the fill value is what fails WCAG as text. */}
      <div className="note" style={{ marginBottom: '12px', color: 'var(--accent-ink)' }}>
        {t('cluster')} {city.cluster} — {typology}
      </div>
      {MEASURES.map((m) => (
        <ClusteredBar
          key={m.tk}
          label={t(m.tk)}
          measure={m}
          rows={rows}
          max={maxes.get(m.k) ?? 1}
          periodLabel={periodLabel}
        />
      ))}
      <div
        style={{
          display: 'flex',
          gap: '18px',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: 'var(--ui-rule) solid var(--ui-line)',
        }}
      >
        {/* Prototype lines 1091-1094. The two coloured figures are 19px TEXT, so they take the
          * DISCRETE ink tokens (spec §3 / §5.4) where the original used the fills `--hot-4` and
          * `--cold-4`. `var()` rather than a resolved hex, so a theme flip needs no re-render. */}
        {(
          [
            [t('hotspots'), city.hot, 'var(--hot-4-ink)'],
            [t('coldspots'), city.cold, 'var(--cold-4-ink)'],
            [t('hotdays'), city.hotdays, ''],
          ] as const
        ).map(([label, value, col]) => (
          <div key={label}>
            <div
              style={{
                fontSize: '9.5px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--ui-muted)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 'var(--font-heading-weight)' as unknown as number,
                fontSize: '19px',
                color: col || 'inherit',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
