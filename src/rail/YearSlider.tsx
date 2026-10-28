/* Rail group 9 - the year slider. Markup from prototype lines 332-335, behaviour from the
 * `#year` handler, lines 994-996.
 *
 * WHY THIS IS STILL A NATIVE `<input type="range">` AND NOT A RADIX SLIDER.
 *
 * Task 5's plan step said "`#opacity` and `#year` become Radix `Slider`". They do not, and the
 * reason is the constraint that outranks the plan: the rebuild has to be visually
 * indistinguishable from the original, and `input[type=range]` is a selector the fidelity guard
 * measures (tests/fidelity/fidelity.spec.ts SELECTORS).
 *
 *   - A Radix Slider renders spans. There would then be NO `input[type=range]` in the rebuild
 *     at all, and the guard's "in the original, missing from the rebuild, and not in PENDING"
 *     branch fails outright. Putting the selector back in PENDING would be the silencing the
 *     brief forbids.
 *   - The look is UA chrome. `input[type=range]{width:100%;accent-color:var(--color-accent);
 *     height:18px}` is the ENTIRE styling: the track, the thumb, their sizes and their colour
 *     all come from the browser's native range widget via `accent-color`. A span-based slider
 *     has to re-draw all of that by hand, and matching Chromium's native thumb pixel-for-pixel
 *     in two themes is not something a hand-written track reaches.
 *   - There is nothing to fix. The two §9.1 bugs in this task's scope are bug 2 and bug 3, both
 *     about the layer toggles. A native range input is already `role="slider"` with
 *     `aria-valuenow`/`min`/`max`, already a tab stop, already arrow- and Home/End-operable.
 *     Radix would be replacing a correct accessible control with a reimplementation of it.
 *
 * The same reasoning keeps `#cluster` a native `<select>` (see ClusterSelect.tsx).
 *
 * `step={1}` is explicit in the original and kept, even though 1 is the default: the back-cast
 * is defined per whole year and a fractional year has no meaning in `spotValue`.
 *
 * No map seam: the handler's other half (`renderSpots(); renderKPIs();`) is a pure function of
 * `state.year`, which the KPI tiles already read through `spotValue`.
 */

import { useT } from '../app/I18nProvider';
import { useAppState } from '../app/state';

/** The slider's own bounds, exported so the ONE other thing that has to know them - spec §8.4's
 * deep link decoder, which rejects `?year=99999` - reads them from the control that defines
 * them rather than repeating the literals. The JSX below uses these, so the two can never
 * drift. 2015-2024 is the MODIS record the Sen slope was fitted over. */
export const YEAR_MIN = 2015;
export const YEAR_MAX = 2024;

export function YearSlider() {
  const t = useT();
  const [state, patch] = useAppState();

  return (
    <div>
      <div className="sec-h">
        <span id="yearLabel" data-i18n="year">{t('year')}</span>
        <span id="yearVal">{state.year}</span>
      </div>
      <input
        type="range"
        id="year"
        /* TASK 12, axe `label` (critical) - see the note on `#opacity` in Layers.tsx for why
         * the name is borrowed from the visible heading instead of written here. */
        aria-labelledby="yearLabel"
        min={YEAR_MIN}
        max={YEAR_MAX}
        step={1}
        value={state.year}
        onChange={(e) => patch({ year: Number(e.target.value) })}
      />
      <p className="note" style={{ margin: '4px 0 0' }} data-i18n="year_note">
        {t('year_note')}
      </p>
    </div>
  );
}
