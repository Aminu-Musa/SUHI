/* `.drawer` - the spot and city detail panel. `closeDrawer` / `openSpot` / `openCity`,
 * prototype lines 877-956.
 *
 * A NON-MODAL RADIX DIALOG WITH `forceMount`, AND BOTH HALVES OF THAT ARE LOAD-BEARING.
 *
 * `modal={false}` because the original's drawer is not modal in any sense: the map keeps panning
 * under it, the rail keeps working, tooltips keep appearing, and `map.on('click', closeDrawer)`
 * (line 632) is the only outside click that dismisses it. A modal dialog would `aria-hidden`
 * the rest of the page and block pointer events on the map - a behaviour change in the name of
 * a pattern the original does not use.
 *
 * `forceMount` because `.drawer` is a selector the fidelity guard measures on a page where
 * nothing is open. The original's aside is always in the DOM, empty, at
 * `transform: translateX(100%)`; `[data-open=true]` releases the transform and CSS animates it
 * (app.css, transcribed). Letting Radix unmount the content would delete a compared selector
 * AND throw away the slide, because there would be nothing to transition from.
 *
 * WHAT THAT COSTS, STATED PLAINLY: Radix's non-modal content sets `trapFocus: false`
 * unconditionally, and `forceMount` means its mount/unmount focus hooks never fire on open or
 * close. So Radix gives us Escape-to-dismiss, `role="dialog"` and `aria-labelledby` from
 * `Dialog.Title`, and the focus trap, the initial focus and the focus restore are written here.
 * The brief asks for a non-modal dialog that traps focus; those two are Radix's own opposites,
 * so one of them had to be ours.
 *
 * §9.1 BUG 4, SANCTIONED AND VISIBLE: `openCity`'s population bar was
 *   width: Math.min(100, c.pop_hot / 230)%
 * The 230 is a magic number - it happens to make Lagos's 23,000 people fill the track - and
 * every city under 230 people drew a sub-1% sliver while everything over 23,000 silently
 * clamped. The house convention for a bar with no natural track is spec §7.5's: scale against
 * the NATIONAL MAXIMUM for that measure. So the denominator is the largest `pop_hot` in
 * cities.json, the clamp becomes unreachable rather than load-bearing, and the bar answers
 * "how does this city compare with the worst one" - which is the only question a single
 * absolute figure on a track can answer. `ALLOWED_DIFFS` carries its entry.
 *
 * §9.1 BUG 8, SANCTIONED AND INVISIBLE: the opened record is announced through an `aria-live`
 * region, and `@media (prefers-reduced-motion: reduce)` in app.css drops the slide. The live
 * region is a sibling of `.drawer` rather than a child, because a child would be removed with
 * the content on close and a region that is not already in the accessibility tree announces
 * nothing when it appears.
 *
 * RULING 32: `.pill` is `color: <ramp>` with `border: solid currentColor` at 9.5px, so the ramp
 * colour is the text AND the border - the worst ramp-as-text case on the page (Nocturne
 * `--cold-5` measures 1.75:1 on `--color-bg`). It takes the ink scale, and `currentColor` carries
 * the fix into the border for nothing. Same for the `bh_significant` row's `--hot-4`. The one
 * thing that stays on the fill ramp is the 8x8px swatch in the spot list, which is a fill.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { max } from 'd3';
import { useT } from '../app/I18nProvider';
import { useTheme } from '../app/ThemeProvider';
import { useAppState } from '../app/state';
import type { City, Cluster, SpotProperties, SuhiData } from '../app/data';
import { fmt } from '../rail/stats';
import { spotFillColor, spotInkFill } from './ink';
import { useInteractions } from './interactions';

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
const signedF = (n: number, d: number): string => (n > 0 ? `+${fmt(n, d)}` : fmt(n, d));

/** §9.1 bug 4's replacement for the magic 230: the largest `pop_hot` in the data. `|| 1` for
 * the same reason `popScale` has one - `max([])` is undefined, and a `/undefined` width is
 * `NaN%`, which the browser drops silently. */
export function popBarDenominator(cities: readonly City[]): number {
  return max(cities, (c) => c.pop_hot) || 1;
}

/** The bar's width as a percentage. Kept separate from the markup so bug 4 can be pinned on
 * numbers: at the maximum it is 100, and the clamp is never what produces that. */
export function popBarPercent(popHot: number, denominator: number): number {
  return Math.min(100, (popHot / denominator) * 100);
}

/** Tab-cycling targets inside the drawer. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  readonly data: SuhiData | null;
}

export function Drawer({ data }: DrawerProps) {
  const t = useT();
  const { drawer, closeDrawer } = useInteractions();
  const panel = useRef<HTMLElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const open = drawer !== null;

  /* Initial focus and focus restore, which Radix's non-modal + forceMount combination does not
   * do for us (see the header). `open` is the only dependency: a change of TARGET while the
   * drawer is already open must not steal focus a second time, which is what a reader clicking
   * a row in the city list does. */
  useEffect(() => {
    if (open) {
      restoreTo.current = document.activeElement as HTMLElement | null;
      panel.current?.querySelector<HTMLElement>('.x')?.focus();
      return;
    }
    const back = restoreTo.current;
    restoreTo.current = null;
    /* `isConnected` because the element that opened the drawer may be gone: a `.citycircle`
     * click calls `focusCity`, which narrows the scope, which re-renders the overlay - so the
     * node that was focused no longer exists by the time the drawer closes. */
    if (back?.isConnected) back.focus();
  }, [open]);

  const trapFocus = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const host = panel.current;
    if (!host) return;
    const stops = [...host.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || active === host)) {
      e.preventDefault();
      last.focus();
    }
  }, []);

  const announcement = useMemo(() => {
    if (!drawer) return '';
    if (drawer.kind === 'city') return `${t('city')}: ${drawer.city}`;
    const p = drawer.spot;
    return `${p.spot_type === 'hot' ? t('hotspots') : t('coldspots')}: ${p.spot_id}, ${p.city}`;
  }, [drawer, t]);

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDrawer();
        }}
        modal={false}
      >
        <Dialog.Content
          forceMount
          asChild
          /* Radix warns in dev when neither is present, and the original has no description -
           * the heading is the whole label. */
          aria-describedby={undefined}
          /* The original dismisses on a MAP click and nothing else (line 632), so a click in
           * the rail or the header must not close the drawer. MapStage reproduces the map
           * click itself. */
          onInteractOutside={(e) => e.preventDefault()}
          /* Both are no-ops under forceMount anyway; preventing them explicitly stops Radix
           * moving focus to the drawer at APP BOOT, when the content is mounted and closed. */
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <aside
            className="drawer"
            id="drawer"
            data-open={open ? 'true' : 'false'}
            /* Closed, the drawer is off-screen AND empty, as the original's was. The attribute
             * keeps it out of the accessibility tree while it is neither. */
            aria-hidden={open ? undefined : true}
            ref={panel}
            onKeyDown={trapFocus}
          >
            {drawer?.kind === 'spot' ? <SpotPanel spot={drawer.spot} /> : null}
            {drawer?.kind === 'city' && data ? <CityPanel name={drawer.city} data={data} /> : null}
          </aside>
        </Dialog.Content>
      </Dialog.Root>
      {/* §9.1 bug 8. Clipped to nothing rather than `display:none`, which is not announced. */}
      <div className="sr-only" id="drawerLive" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}

function CloseButton() {
  return (
    <Dialog.Close asChild>
      <button className="x" aria-label="Close">
        ✕
      </button>
    </Dialog.Close>
  );
}

/** Prototype lines 878-916. */
function SpotPanel({ spot: p }: { readonly spot: SpotProperties }) {
  const t = useT();
  const { theme } = useTheme();
  const [state] = useAppState();
  const { focusCity } = useInteractions();
  return (
    <>
      <CloseButton />
      <div className="pill" style={{ color: spotInkFill(p, state.year, theme) }}>
        {p.spot_type === 'hot' ? t('hotspots') : t('coldspots')} · {p.period === 'day' ? t('day') : t('night')}
      </div>
      <Dialog.Title asChild>
        <h3 style={{ margin: '10px 0 2px', fontSize: '21px', fontFamily: 'var(--font-heading)' }}>{p.city}</h3>
      </Dialog.Title>
      <div className="note">
        {p.spot_id} · tier {String(p.tier)} · {String(p.zone)} · {t('cluster').split(' ')[0]} {p.cluster25}
      </div>
      <div className="rule"></div>
      <div className="kpis">
        <div className={`kpi ${p.spot_type}`}>
          <div className="lab">{t('suhi_int')}</div>
          <div className="val">{signed(p.suhii)}</div>
          <div className="sub">{t('vs_rural')}</div>
        </div>
        <div className="kpi">
          <div className="lab">{t('population')}</div>
          <div className="val">{fmt(p.population)}</div>
          <div className="sub">{t('pop_note')}</div>
        </div>
      </div>
      <div className="rule"></div>
      <div className="sec-h">{t('thermal')}</div>
      <dl className="dl2">
        <dt>{t('mean_lst')}</dt>
        <dd>{fmt(p.mean_lst, 2)} °C</dd>
        <dt>{t('minmax_lst')}</dt>
        <dd>
          {fmt(p.max_lst, 1)} / {fmt(p.min_lst as number, 1)} °C
        </dd>
        <dt>Std dev</dt>
        <dd>{fmt(p.std_lst as number, 2)}</dd>
        <dt>MODIS {t('hotdays').toLowerCase()}</dt>
        <dd>{p.n_modis_hot_days}</dd>
        <dt>{t('persistent')}</dt>
        <dd>{p.persistent_dn ? '✓' : '—'}</dd>
      </dl>
      <div className="rule"></div>
      <div className="sec-h">{t('trendconf')}</div>
      <dl className="dl2">
        <dt>Sen slope</dt>
        <dd>{signedF(p.sen_slope_C_per_decade, 2)} °C/dec</dd>
        <dt>Mann–Kendall</dt>
        <dd>{String(p.mk_trend)}</dd>
        <dt>p-value</dt>
        {/* `toFixed(4)`, not `fmt`: the original says so (line 904) and the two differ - `fmt`
          * groups thousands and renders a d3 minus sign. A p-value has neither. */}
        <dd>{p.mk_p_value == null ? '—' : p.mk_p_value.toFixed(4)}</dd>
        <dt>{t('significant')}</dt>
        <dd style={{ color: p.bh_significant ? 'var(--hot-4-ink)' : 'var(--ui-muted)' }}>
          {p.bh_significant ? '✓' : '—'}
        </dd>
        <dt>Validation</dt>
        <dd>{String(p.nb04_val_tier)}</dd>
      </dl>
      <div className="rule"></div>
      <div className="sec-h">{t('physctx')}</div>
      <dl className="dl2">
        <dt>{t('landcover')}</dt>
        <dd>{String(p.landcover_class)}</dd>
        <dt>{t('elevation')}</dt>
        <dd>{String(p.elevation_class)}</dd>
        <dt>{t('geology')}</dt>
        <dd>{String(p.geology_class)}</dd>
        <dt>{t('climate')}</dt>
        <dd>{String(p.climate_class)}</dd>
        <dt>
          {t('area')} ({p.contour_level})
        </dt>
        <dd>{fmt(p.area_km2, 2)} km²</dd>
        <dt>Dense core</dt>
        <dd>{p.dense_core_pct == null ? '—' : `${String(p.dense_core_pct)}%`}</dd>
      </dl>
      <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
        {/* The original generated `onclick="focusCity('${p.city.replace(/'/g,"\\'")}')"` - a
          * quote hand-escaped into an HTML attribute. No city in the data contains an
          * apostrophe, so it never fired; a React handler removes the class of bug outright. */}
        <button className="ghost" onClick={() => focusCity(p.city)}>
          {t('zoom_city')}
        </button>
        {/* Inert in the original too (line 915): no handler, no target. Transcribed as it is
          * rather than wired to an invented destination. */}
        <button className="ghost">{t('add_report')}</button>
      </div>
    </>
  );
}

/** Prototype lines 917-956. */
function CityPanel({ name, data }: { readonly name: string; readonly data: SuhiData }) {
  const t = useT();
  const { theme } = useTheme();
  const [state] = useAppState();
  const { openSpot } = useInteractions();
  const c: City | undefined = data.cities.find((x) => x.city === name);
  const spots = useMemo(
    () =>
      data.spots.features
        .filter((f) => f.properties.city === name && f.properties.contour_level === 'L50')
        .map((f) => f.properties),
    [data.spots, name],
  );
  const denominator = useMemo(() => popBarDenominator(data.cities), [data.cities]);
  /* `openCity` returns early when the name is unknown (line 918), leaving whatever was in the
   * drawer. Here there is nothing to leave, so it renders nothing and the panel stays closed
   * in effect - same outcome, one fewer stale-content path. */
  if (!c) return null;
  const typology: string = (data.clusters as Cluster[]).find((k) => k.id === c.cluster)?.typology ?? '';
  return (
    <>
      <CloseButton />
      <div className="pill" style={{ color: 'var(--accent-ink)' }}>
        {t('city')}
      </div>
      <Dialog.Title asChild>
        <h3 style={{ margin: '10px 0 2px', fontSize: '21px', fontFamily: 'var(--font-heading)' }}>{c.city}</h3>
      </Dialog.Title>
      <div className="note">
        {c.climate} · {c.elev} · {c.geol}
      </div>
      <div className="rule"></div>
      <div className="kpis">
        <div className="kpi hot">
          <div className="lab">{t('hotspots')}</div>
          <div className="val">{c.hot}</div>
          <div className="sub">
            {fmt(c.area_hot, 0)} km² · {c.pct_hot}%
          </div>
        </div>
        <div className="kpi cold">
          <div className="lab">{t('coldspots')}</div>
          <div className="val">{c.cold}</div>
          <div className="sub">{fmt(c.area_cold, 0)} km²</div>
        </div>
        <div className="kpi wide">
          <div className="lab">{t('pop_in_hot')}</div>
          <div className="val">{fmt(c.pop_hot)}</div>
          <div className="bar">
            <i
              style={{
                width: `${popBarPercent(c.pop_hot, denominator)}%`,
                background: 'linear-gradient(90deg,var(--hot-2),var(--hot-5))',
              }}
            ></i>
          </div>
        </div>
      </div>
      <div className="rule"></div>
      <dl className="dl2">
        <dt>{t('suhi_int')}</dt>
        <dd>{signed(c.suhii)} °C</dd>
        <dt>
          {t('mean_lst')} / {t('max_lst')}
        </dt>
        <dd>
          {fmt(c.mean_lst, 1)} / {fmt(c.max_lst, 1)} °C
        </dd>
        <dt>{t('warming')}</dt>
        <dd>{signed(c.slope)} °C/dec</dd>
        <dt>MODIS {t('hotdays').toLowerCase()}</dt>
        <dd>{c.hotdays}</dd>
        <dt>{t('city_area')}</dt>
        <dd>{fmt(c.city_area, 0)} km²</dd>
        <dt>{t('urban_core')}</dt>
        <dd>{fmt(c.uc_area, 0)} km²</dd>
        <dt>{t('persistent')}</dt>
        <dd>{c.persist}</dd>
        <dt>{t('significant')}</dt>
        <dd>{c.sig}</dd>
        <dt>{t('pop_in_cold')}</dt>
        <dd>{fmt(c.pop_cold)}</dd>
        <dt>{t('cluster')}</dt>
        <dd>{c.cluster}</dd>
        <dt>{t('geology')}</dt>
        <dd>{c.geol}</dd>
      </dl>
      <div className="note" style={{ marginTop: '6px', color: 'var(--accent-ink)' }}>
        {typology}
      </div>
      <div className="rule"></div>
      <div className="sec-h">{t('spots_at')} L50</div>
      <div className="rowlist">
        {spots.map((s) => (
          /* `.rw` carried `data-sid` and a click handler attached in a second pass (line 955).
           * A DIV with `role="button"`, not a real `<button>`, and that is deliberate: `.rw`
           * declares `font-size` and no `font-family` or `background`, so a real button would
           * take the UA's font and its grey ground - a visible change to a row the guard
           * measures (Task 5's `.rw` in the search results is the first match, and it is a
           * div for the same reason). The role plus Enter/Space is §9.1 bug 3's correction
           * applied to the same mouse-only pattern, at no pixel cost. */
          <div
            role="button"
            tabIndex={0}
            className="rw"
            key={s.spot_id}
            data-sid={s.spot_id}
            onClick={() => openSpot(s)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              openSpot(s);
            }}
          >
            <span>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  marginRight: '6px',
                  background: spotFillColor(s, state.year, theme),
                }}
              ></span>
              {s.spot_id}
            </span>
            <span className="n">{signed(s.suhii)}°</span>
          </div>
        ))}
      </div>
    </>
  );
}
