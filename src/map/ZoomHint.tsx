/* `#zoomHint` - ruling 9's on-screen disclosure. `updateZoomHint`, prototype lines 738-746.
 *
 * This element is why the geometry exaggeration is a design decision rather than a hack: the map
 * states its own distortion, in the reader's language, and switches to "true extent" the moment
 * the factor reaches 1. Both strings exist in all four languages (`hint_zoom`, `hint_true`;
 * dictionary lines 136-140), which is the clearest evidence that the behaviour was intended to
 * be seen. Deleting the exaggeration would orphan eight translated strings.
 *
 * `hint_zoom` carries a `{k}` placeholder and the original substituted `'x' + k` with a
 * MULTIPLICATION SIGN (U+00D7), not the letter x - so a factor of 9 reads "scaled x9". The
 * `t()` helper does no interpolation, so the replacement happens here, exactly as line 741 did
 * it. Pinned by a test, because `×` and `x` are indistinguishable in most editors.
 *
 * The inline colour is the original's too (line 742): accent while the geometry is exaggerated,
 * `--ui-muted` once it is not. `.mapsub` already sets `--ui-muted`, so the muted branch is
 * redundant in CSS terms and is kept because the element's style attribute is what the original
 * renders and `.ovl` is a measured selector.
 */

import { useT } from '../app/I18nProvider';

export interface ZoomHintProps {
  /** The active exaggeration factor from `MapStage`. 1 means "no exaggeration". */
  readonly factor: number;
}

export function ZoomHint({ factor }: ZoomHintProps) {
  const t = useT();
  const on = factor > 1;
  return (
    <p
      className="mapsub"
      id="zoomHint"
      style={{ color: on ? 'var(--color-accent)' : 'var(--ui-muted)' }}
    >
      {on ? t('hint_zoom').replace('{k}', `×${factor}`) : t('hint_true')}
    </p>
  );
}
