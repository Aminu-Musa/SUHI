/* Rail group 3 - the Mann-Kendall confidence bars. Markup from prototype lines 283-287, bars
 * from the `#conf` tail of `renderKPIs`, lines 1059-1067.
 *
 * It shares `feats` with the KPI tiles - the same L50-only, city- and cluster-filtered set - so
 * the bars and the tiles can never disagree about how many spots are in scope. That is why the
 * aggregation lives in stats.ts and both groups are handed the result.
 *
 * The bar fills keep the plain ramp tokens (`--hot-5`, `--hot-3`, `--hot-1`,
 * `--color-neutral-500`): a bar is a fill, and only ramp-coloured TEXT moves to the -ink scale.
 * The original resolved each token to a literal rgb() through `cssv()` before writing it into
 * the style attribute; `var(--hot-5)` renders the identical colour and survives a theme change
 * without a re-render, which the literal did not.
 *
 * The denominator is `max || 1` (prototype line 1064), which is the only thing keeping an empty
 * filter from writing `width:NaN%` into four style attributes.
 */

import { useT } from '../app/I18nProvider';
import { confBins, type KpiStats } from './stats';

export function Confidence({ stats }: { readonly stats: KpiStats }) {
  const t = useT();
  const { bins, significant, total } = confBins(stats.feats);

  return (
    <div>
      <div className="sec-h">
        <span data-i18n="confidence">{t('confidence')}</span>
        <span>Gi* / BH</span>
      </div>
      <div id="conf">
        {bins.map((b) => (
          <div className="cbar" key={b.label}>
            <span className="t">{b.label}</span>
            <span className="track">
              <i style={{ width: `${b.pct}%`, background: `var(${b.token})` }} />
            </span>
            <span className="v">{b.n}</span>
          </div>
        ))}
        <p className="note">
          {significant} / {total} — BH
        </p>
      </div>
    </div>
  );
}
