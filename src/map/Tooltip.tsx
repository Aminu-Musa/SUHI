/* `#tip` - the one shared hover tooltip. `showTip` / `spotTip` / `cityTip`, prototype lines
 * 852-877. The element is a sibling of `.app` (line 404), so it is rendered by `App` and filled
 * from the interactions context by whichever layer is hovered.
 *
 * THE ELEMENT NEVER UNMOUNTS. `.tip` is `opacity: 0` with `transition: opacity .1s` and the
 * original toggled only that (lines 852-856, 864), so the fade is CSS and the node is
 * permanent - which is also why `.tip` is a selector the fidelity guard measures on a page
 * where nothing is hovered. Rendering it conditionally would delete a compared selector and
 * throw away the fade.
 *
 * RULING 32 - EVERY COLOUR HERE IS THE INK SCALE. `spotTip`'s `<b>` took `spotFill(p)`, a fill
 * ramp colour, as 13px text; `cityTip`'s hot/cold counts took `--hot-4` / `--cold-4` at 11.5px;
 * its cluster line took `--color-accent`. All four are text on `--ui-tip`, so all four take the
 * `-ink` siblings. The INTERPOLATED one has to be a resolved hex (d3 mixes two concrete
 * colours), which is what `spotInkFill` is for; the three STATIC ones go in as `var(--…-ink)`
 * and re-resolve on a theme flip without a re-render.
 */

import { useT } from '../app/I18nProvider';
import { useTheme } from '../app/ThemeProvider';
import { useAppState } from '../app/state';
import type { City, Cluster, SpotProperties, SuhiData } from '../app/data';
import { fmt } from '../rail/stats';
import { spotInkFill } from './ink';
import { useInteractions } from './interactions';

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Prototype lines 856-863. */
export function SpotTip({ spot }: { readonly spot: SpotProperties }) {
  const t = useT();
  const { theme } = useTheme();
  const [state] = useAppState();
  return (
    <>
      <b style={{ color: spotInkFill(spot, state.year, theme) }}>
        {spot.city} · {spot.spot_type === 'hot' ? t('hotspots') : t('coldspots')}
      </b>
      <div className="note">
        {spot.spot_id} · {spot.period === 'day' ? t('day') : t('night')} · {spot.contour_level}
      </div>
      <dl>
        <dt>SUHI</dt>
        <dd>{signed(spot.suhii)} °C</dd>
        <dt>{t('mean_lst')}</dt>
        <dd>{fmt(spot.mean_lst, 1)} °C</dd>
        <dt>{t('area')}</dt>
        <dd>{fmt(spot.area_km2, 1)} km²</dd>
        <dt>{t('population')}</dt>
        <dd>{fmt(spot.population)}</dd>
      </dl>
    </>
  );
}

/** Prototype lines 865-876. */
export function CityTip({ city, clusters }: { readonly city: City; readonly clusters: readonly Cluster[] }) {
  const t = useT();
  const typology = clusters.find((k) => k.id === city.cluster)?.typology ?? '';
  return (
    <>
      <b>{city.city}</b>
      <div className="note">
        {city.landcover} · {city.elev} · {city.geol}
      </div>
      <div className="note" style={{ color: 'var(--accent-ink)' }}>
        {t('cluster')} {city.cluster} — {typology}
      </div>
      <dl>
        <dt>
          {t('hotspots')} / {t('coldspots')}
        </dt>
        <dd>
          <span style={{ color: 'var(--hot-4-ink)' }}>{city.hot}</span>
          {' / '}
          <span style={{ color: 'var(--cold-4-ink)' }}>{city.cold}</span>
        </dd>
        <dt>{t('suhi_int')}</dt>
        <dd>{signed(city.suhii)} °C</dd>
        <dt>{t('pop_in_hot')}</dt>
        <dd>{fmt(city.pop_hot)}</dd>
        <dt>{t('pop_in_cold')}</dt>
        <dd>{fmt(city.pop_cold)}</dd>
        <dt>{t('hot_area')}</dt>
        <dd>
          {fmt(city.area_hot, 1)} km² ({city.pct_hot}%)
        </dd>
      </dl>
    </>
  );
}

export function Tooltip({ data }: { readonly data: SuhiData | null }) {
  const { tip } = useInteractions();
  const shown = tip?.visible ? tip.target : null;
  const city = shown?.kind === 'city' ? data?.cities.find((c) => c.city === shown.city) : undefined;

  /* `tip` outlives a hide (see `TipState.visible`), so `left`/`top` stay applied and only the
   * opacity moves - which is all the original's `hideTip` did. */
  return (
    <div
      className="tip"
      id="tip"
      style={tip ? { opacity: tip.visible ? 1 : 0, left: `${tip.left}px`, top: `${tip.top}px` } : undefined}
    >
      {shown?.kind === 'spot' ? <SpotTip spot={shown.spot} /> : null}
      {city ? <CityTip city={city} clusters={data?.clusters ?? []} /> : null}
    </div>
  );
}
