/* The rail's contents - all ten groups, in the original's order, plus the `.i18nnote` footer.
 *
 * `.rail` itself - the element, its id and its display:none off the Map tab - belongs to App,
 * because `selectTab` addressed it by id (prototype line 1022). This component renders only the
 * group `<div>`s inside it, which is what `.rail{display:flex;flex-direction:column;gap:...}`
 * lays out: one child per group, no wrapper, or the gap would collapse to a single gap.
 *
 * The KPI aggregation runs ONCE here and is handed to both the tiles and the confidence bars.
 * The original computed it once inside renderKPIs and wrote two innerHTMLs from it, and the two
 * groups must agree about the in-scope set or the bars would count spots the tiles do not.
 *
 * While the data is still loading (`data === null`) the groups that need it render nothing. The
 * original had the same gap and solved it by not building the rail at all until Promise.all
 * resolved (prototype line 603); here the chrome that needs no data - search box, segments,
 * section headers - is up immediately and the figures arrive with the fetch.
 */

import { useMemo } from 'react';
import { useT } from '../app/I18nProvider';
import type { SuhiData } from '../app/data';
import { useAppState } from '../app/state';
import { BasemapSeg, type BaseKey } from './BasemapSeg';
import { ClusterSelect } from './ClusterSelect';
import { Confidence } from './Confidence';
import { ContourSeg } from './ContourSeg';
import { Kpis } from './Kpis';
import { Layers } from './Layers';
import { Legend } from './Legend';
import { PopCircles } from './PopCircles';
import { Search } from './Search';
import { YearSlider } from './YearSlider';
import { kpiStats } from './stats';

export interface RailProps {
  readonly data: SuhiData | null;
  readonly baseKey: BaseKey;
  readonly onPickBase: (key: BaseKey) => void;
  /** Map-side seam for `focusCity` (prototype line 818). Task 6-7 fit the bounds and open the
   * city drawer; the state change is done here so the rail responds before the map exists. */
  readonly onFocusCity?: (city: string) => void;
  /** Map-side seam for `fitNation` + `closeDrawer` (prototype line 1005). */
  readonly onResetScope?: () => void;
}

export function Rail({ data, baseKey, onPickBase, onFocusCity, onResetScope }: RailProps) {
  const t = useT();
  const [state, patch] = useAppState();
  const stats = useMemo(
    () => (data ? kpiStats(data.spots, data.cities, state) : null),
    [data, state],
  );

  return (
    <>
      <Search
        cities={data?.cities ?? []}
        onPickCity={(city) => {
          patch({ city });
          onFocusCity?.(city);
        }}
      />
      {stats && data ? (
        <>
          <Kpis
            stats={stats}
            cities={data.cities}
            onResetScope={() => {
              patch({ city: null });
              onResetScope?.();
            }}
          />
          <Confidence stats={stats} />
        </>
      ) : null}
      <BasemapSeg baseKey={baseKey} onPickBase={onPickBase} />
      <ContourSeg />
      <Layers spots={data?.spots ?? null} />
      <ClusterSelect clusters={data?.clusters ?? []} />
      <PopCircles cities={data?.cities ?? []} />
      <YearSlider />
      <Legend />
      {/* A direct child of `aside.rail`, not of a group - it is the last item `.rail`'s
       * flex column lays out (prototype line 353), and its top border is what separates it
       * from the legend above. */}
      <p className="i18nnote" data-i18n="i18n_note">
        {t('i18n_note')}
      </p>
    </>
  );
}
