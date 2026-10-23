/* Rail group 5 - the contour level segment. Markup from prototype lines 294-300, behaviour from
 * the `#contourSeg` handler, lines 983-988.
 *
 * The four labels are hard-coded English in the original - 'All 441', 'L50', 'L75', 'L90' - with
 * no data-i18n attribute, so they stay English in all four languages. 'All 441' counts the
 * features in spots.geojson; it is a literal in the markup, not a computed count.
 *
 * The note explains why the KPI tiles below ignore this control entirely: the levels are nested,
 * so the counts and areas always use L50 only (see stats.ts).
 */

import { useT } from '../app/I18nProvider';
import { useAppState, type Contour } from '../app/state';
import { Seg } from './Seg';

const OPTIONS = [
  { value: 'all', label: 'All 441' },
  { value: 'L50', label: 'L50' },
  { value: 'L75', label: 'L75' },
  { value: 'L90', label: 'L90' },
] as const;

export function ContourSeg() {
  const t = useT();
  const [state, patch] = useAppState();
  return (
    <div>
      <div className="sec-h" data-i18n="contour">
        {t('contour')}
      </div>
      <Seg
        id="contourSeg"
        options={OPTIONS}
        value={state.contour}
        onChange={(v) => patch({ contour: v as Contour })}
      />
      <p className="note" style={{ margin: '6px 0 0' }} data-i18n="contour_note">
        {t('contour_note')}
      </p>
    </div>
  );
}
