/* Rail group 7 - the cluster typology picker and its card. Markup from prototype lines 311-315,
 * the option list from `buildRail` lines 972-977, the card from `renderClusterCard`, 791-817.
 *
 * STILL A NATIVE `<select class="search">`, not a Radix Select, for the reason spelled out in
 * YearSlider.tsx: `.search` is a measured selector whose whole appearance - including the
 * dropdown arrow the UA draws - comes from the browser's native select widget. A Radix trigger
 * is a `<button>`: no arrow, centred rather than start-aligned text, and a different line box.
 * It is also the only `.search` the guard does NOT measure (the search input is first in the
 * document), so a regression here would be invisible to the guard - which is a reason to be
 * more careful, not less. A native select is already keyboard- and screen-reader-complete.
 *
 * `cl.value = state.cluster` (line 976) is what React's `value` prop already does; the
 * `onChange` is line 977 minus `renderAll()`, which is state-derived.
 *
 * `#clusterCount` reads `'k=25 · ' + CLUSTERS.length + ' occupied'`. The 25 is a LITERAL: it is
 * the k the clustering was run at, and clusters.json holds the 16 that came out non-empty. The
 * two numbers disagreeing is the fact being reported, not a bug.
 *
 * THE CARD'S TWO BRANCHES. With `state.cluster === 'all'` - the initial state - it renders the
 * top five typologies as `.cbar` rows, which is why the fidelity guard never sees the other
 * branch: picking a cluster renders `.card2` and `.dl2`, both still in PENDING for Tasks 7-8.
 * They are implemented here anyway, because this component owns them and leaving them out would
 * mean the control did nothing. **Task 7/8 note:** the moment either of you deletes a `.card2`
 * or `.dl2` PENDING line, those selectors start being compared against the original's drawer /
 * compare card, NOT against this one - the guard measures the first match in the document and
 * the rail comes before the stage. Nothing here needs to change for that; it is only surprising
 * if you go looking for which element the guard picked up.
 *
 * `.cbar .t` carries an inline `font-size:10.5px` and the fill is `var(--color-accent)` - a
 * fill, so it keeps the plain token and does not move to `--accent-ink`.
 *
 * The typology label on a bar is `t.split(' · ')[0]`: the landcover only. The full three-part
 * string is in the option list and in the card heading.
 */

import { useT } from '../app/I18nProvider';
import type { Cluster } from '../app/data';
import { useAppState } from '../app/state';
import { fmt } from './stats';

/** Prototype lines 792-796: cities-per-typology, biggest first, top five. */
export function topTypologies(clusters: readonly Cluster[]): { typology: string; n: number }[] {
  const byT = new Map<string, number>();
  for (const k of clusters) byT.set(k.typology, (byT.get(k.typology) ?? 0) + k.n_cities);
  return [...byT.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([typology, n]) => ({ typology, n }));
}

export function ClusterSelect({ clusters }: { readonly clusters: readonly Cluster[] }) {
  const t = useT();
  const [state, patch] = useAppState();

  return (
    <div>
      <div className="sec-h">
        <span data-i18n="cluster_typology">{t('cluster_typology')}</span>
        <span id="clusterCount">{clusters.length > 0 ? `k=25 · ${clusters.length} occupied` : ''}</span>
      </div>
      <select
        id="cluster"
        className="search"
        value={state.cluster}
        onChange={(e) => patch({ cluster: e.target.value })}
      >
        <option value="all">{t('all_clusters')}</option>
        {clusters.map((k) => (
          <option key={k.id} value={String(k.id)}>
            {k.id} — {k.typology}
          </option>
        ))}
      </select>
      <div id="clusterCard" style={{ marginTop: 'var(--space-3)' }}>
        <ClusterCard clusters={clusters} />
      </div>
    </div>
  );
}

function ClusterCard({ clusters }: { readonly clusters: readonly Cluster[] }) {
  const t = useT();
  const [state] = useAppState();

  if (state.cluster === 'all') {
    const rows = topTypologies(clusters);
    if (rows.length === 0) return null;
    const max = rows[0].n;
    return (
      <>
        <div className="note" style={{ marginBottom: '5px' }}>
          {t('top_typologies')}
        </div>
        {rows.map((r) => (
          <div className="cbar" key={r.typology}>
            <span className="t" style={{ fontSize: '10.5px' }}>
              {r.typology.split(' · ')[0]}
            </span>
            <span className="track">
              <i style={{ width: `${(r.n / max) * 100}%`, background: 'var(--color-accent)' }} />
            </span>
            <span className="v">{r.n}</span>
          </div>
        ))}
      </>
    );
  }

  const k = clusters.find((x) => String(x.id) === String(state.cluster));
  /* Prototype line 804: an unknown id empties the card rather than erroring. Reachable in one
   * real way - the stored cluster outliving a reclustering - so it is kept. */
  if (!k) return null;

  return (
    <div className="card2" style={{ padding: 'var(--space-4)' }}>
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 'var(--font-heading-weight)' as unknown as number,
          fontSize: '12.5px',
          marginBottom: '6px',
        }}
      >
        {k.typology}
      </div>
      <dl className="dl2" style={{ fontSize: '11.5px' }}>
        <dt>{t('landcover')}</dt>
        <dd>{k.landcover}</dd>
        <dt>{t('elevation')}</dt>
        <dd>{k.elev}</dd>
        <dt>{t('geology')}</dt>
        <dd>{k.geol}</dd>
        <dt>{t('climate')}</dt>
        <dd>{k.climate}</dd>
        <dt>{t('suhi_int')}</dt>
        <dd>
          {k.suhii > 0 ? '+' : ''}
          {k.suhii} °C
        </dd>
        <dt>{t('warming')}</dt>
        <dd>
          {k.slope > 0 ? '+' : ''}
          {k.slope} °C/dec
        </dd>
        {/* Ramp-coloured TEXT, so these two are the -ink tokens (spec §3 / §5.4), where the
         * original used the fills `--hot-4` / `--cold-4` at 11.5px. */}
        <dt>{t('pop_in_hot')}</dt>
        <dd style={{ color: 'var(--hot-4-ink)' }}>{fmt(k.pop_hot)}</dd>
        <dt>{t('pop_in_cold')}</dt>
        <dd style={{ color: 'var(--cold-4-ink)' }}>{fmt(k.pop_cold)}</dd>
      </dl>
      <div className="note" style={{ marginTop: '7px' }}>
        {k.n_cities} {t('cities')}: {k.cities.join(', ')}
      </div>
    </div>
  );
}
