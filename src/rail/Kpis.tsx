/* Rail group 2 - the scope header and the six KPI tiles. Markup from prototype lines 277-281
 * and the `#kpis` template in `renderKPIs`, lines 1038-1050.
 *
 * RULING 8: the figures are NOT uniformly 24px. app.css sets `.kpi .val{font-size:24px}` and
 * three of the six tiles override it inline - the share tile at 19px, both population tiles at
 * 20px. Those overrides are transcribed, not normalised, and they are the reason the ink scale
 * exists: at Nocturne's heading weight 500, 19px and 20px are BODY text under WCAG 2.1, so the
 * 3:1 large-text allowance does not apply and the ramp fills would fail as text.
 *
 * INK, NOT FILL. `.kpi.hot .val` / `.kpi.cold .val` already resolve to `--hot-4-ink` /
 * `--cold-4-ink` in app.css, so tiles 1, 2, 4 and 5 inherit the right colour and MUST NOT set
 * it inline. The share tile's two percentages are the only ramp-coloured text in this group
 * that the original coloured inline (`color:var(--hot-4)` / `var(--cold-4)`, lines 1042-1045);
 * they move to the -ink tokens for the same §3/§5.4 reason. The bar gradients beneath them stay
 * on the plain tokens, because a gradient is a fill and carries no text.
 *
 * SPEC §9.1 BUG 5 (sanctioned, visible). The share bar was
 *   width: Math.min(50, pctHot * 6)%
 * which is proportional to nothing: the ×6 is a magic number and the 50% clamp silently lies
 * about any share above 8.33%. The bar's track IS the studied area and pctHot/pctCold are
 * already percentages of exactly that, so the honest width is the percentage itself. The two
 * bars then read against each other and against the track, which is what a share bar is for.
 *
 * SPEC §9.1 BUG 7 (sanctioned, visible). The sixth tile had only `.lab` and `.sub`, breaking
 * the lab/val/sub grammar of the other five: its one figure, the mean SUHI, was buried mid
 * sentence in the sub-line. It is promoted to a `.val`, and the sub keeps the rest of the
 * sentence. The `.val` takes NO inline font-size: 24px is what `.kpi .val` gives tiles 1 and 2,
 * and inventing a fourth override here would be designing rather than correcting.
 */

import { useT } from '../app/I18nProvider';
import type { City } from '../app/data';
import { useAppState } from '../app/state';
import { fmt, type KpiStats } from './stats';

/* The two share-bar gradients, lifted to constants ONLY so they can be asserted: jsdom's CSS
 * parser drops `background:linear-gradient(...,var(--x),var(--y))` on the floor, attribute and
 * all, so a test reading element.style can neither see these values nor catch an -ink token
 * creeping into a fill. Rendered output is unchanged. */
export const SHARE_BAR_FILL = {
  hot: 'linear-gradient(90deg,var(--hot-2),var(--hot-5))',
  cold: 'linear-gradient(90deg,var(--cold-4),var(--cold-2))',
} as const;

export interface KpisProps {
  readonly stats: KpiStats;
  readonly cities: readonly City[];
  /** `#zreset` / `#scopeReset` (prototype lines 1005, 1014): clear the city, refit the nation,
   * re-render, close the drawer. Clearing the city is ours; the map half is Task 6-7's. */
  readonly onResetScope: () => void;
}

export function Kpis({ stats, onResetScope }: KpisProps) {
  const t = useT();
  const [state] = useAppState();
  const { hot, cold, ah, ac, pop, popC, pctHot, pctCold, clusters, meanS } = stats;

  return (
    <div>
      <div className="sec-h">
        <span id="scopeLabel">
          {state.city ? `${state.city} · ${t('scoped')}` : `${t('national')} · 55 ${t('cities')}`}
        </span>
        {/* The original kept this span in the DOM and toggled style.display between 'none' and
         * '' (prototype line 1053), leaving cursor and colour on it either way. */}
        <span
          id="scopeReset"
          style={{ cursor: 'pointer', color: 'var(--color-accent)', display: state.city ? undefined : 'none' }}
          data-i18n="reset"
          onClick={onResetScope}
        >
          {t('reset')}
        </span>
      </div>

      <div className="kpis" id="kpis">
        <div className="kpi hot">
          <div className="lab">{t('hotspots')}</div>
          <div className="val">{hot.length}</div>
          <div className="sub">{fmt(ah, 0)} km²</div>
        </div>
        <div className="kpi cold">
          <div className="lab">{t('coldspots')}</div>
          <div className="val">{cold.length}</div>
          <div className="sub">{fmt(ac, 0)} km²</div>
        </div>

        <div className="kpi wide">
          <div className="lab">{t('share_area')}</div>
          <div className="val" style={{ fontSize: '19px' }}>
            <span style={{ color: 'var(--hot-4-ink)' }}>{pctHot.toFixed(2)}%</span>
            <span style={{ color: 'var(--ui-muted)', fontSize: '13px' }}> {t('hot')} · </span>
            <span style={{ color: 'var(--cold-4-ink)' }}>{pctCold.toFixed(2)}%</span>
            <span style={{ color: 'var(--ui-muted)', fontSize: '13px' }}> {t('cold')}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${pctHot}%`, background: SHARE_BAR_FILL.hot }} />
            <i style={{ width: `${pctCold}%`, background: SHARE_BAR_FILL.cold }} />
          </div>
        </div>

        <div className="kpi hot">
          <div className="lab">{t('pop_in_hot')}</div>
          <div className="val" style={{ fontSize: '20px' }}>
            {fmt(pop)}
          </div>
          <div className="sub">{t('persons')}</div>
        </div>
        <div className="kpi cold">
          <div className="lab">{t('pop_in_cold')}</div>
          <div className="val" style={{ fontSize: '20px' }}>
            {fmt(popC)}
          </div>
          <div className="sub">{t('persons')}</div>
        </div>

        <div className="kpi wide">
          <div className="lab">{t('typology_mix')}</div>
          <div className="val">{fmt(meanS, 2)} °C</div>
          <div className="sub" style={{ marginTop: '2px' }}>
            {clusters} {t('clusters')} · {t('city_pop_pending')}
          </div>
        </div>
      </div>
    </div>
  );
}
