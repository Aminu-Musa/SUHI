/* Rail group 6 - the six layer toggles and the opacity slider. Markup from prototype lines
 * 305-309, behaviour from `buildRail`'s layer block, lines 958-970, and the `#opacity` handler,
 * lines 990-993.
 *
 * SPEC §9.1 BUG 2 (fixed here, and the fix is structural). `buildRail` wrote
 *
 *     `<div class="ly" data-k="${k}" data-on="true">`                       (line 962)
 *
 * - `data-on="true"` on every row, unconditionally - and `buildRail` was re-called on every
 * language change (line 1015). So picking Hausa re-rendered all six rows as ON while
 * `state.layers` still held the reader's real choices: the switches lied and the map disagreed
 * with them. It was not a one-off render bug, it was a rebuild that discarded state. Here
 * `data-on` is DERIVED from `state.layers[k]`, so there is no second copy of the truth to drift,
 * and switching language re-renders labels only. Layers.test.tsx pins exactly that.
 *
 * SPEC §9.1 BUG 3 (fixed here). The rows were `<div onclick>`: no tab stop, no `role`, no
 * `aria-checked`, so a keyboard or screen-reader user could neither reach nor read them. They
 * are now Radix `Switch.Root`s with `asChild`, which supplies `role="switch"` and
 * `aria-checked`. Two details about that:
 *
 *   - THE CHILD STAYS A `<div>`, not a `<button>`. app.css styles `.ly` without resetting any
 *     of a button's UA appearance (border, background, font-family, text-align), so a button
 *     would render with a chrome border and centred text in both themes - a visible fidelity
 *     break for an attribute. `type` and `value` are overridden to `undefined` so Radix's
 *     button-shaped props do not land on a div.
 *   - BECAUSE the child is a div it has no native activation, so `tabIndex` and an explicit
 *     Enter/Space `onKeyDown` are what actually make bug 3 fixed. Radix's own `onKeyDown` only
 *     suppresses Enter's form submission; it does not toggle.
 *
 * THE CHIPS ARE TRANSCRIBED, INCLUDING THE EMPTY ONES. `exag` and `labels` carry `''`, which
 * still renders a bordered, padded `<span class="chip">` with no text. That empty pill is in the
 * original at both themes; removing it would be design.
 *
 * The spots chip is LIVE (prototype lines 724, 735): `renderSpots` overwrote it with
 * `activeSpots('day').length + activeSpots('night').length`, so it tracks the contour, cluster
 * and city filters. With the default state that is 441, which is why the static markup's literal
 * and the computed value agree at first paint. The count is pure data, so it is computed here
 * rather than left to the map.
 *
 * NO MAP SEAM IS NEEDED for any of these. In the original each handler did two things: mutate
 * `state`, then call `renderSpots()` / `renderCities()` / `natLayer.addTo(map)`. The second half
 * is entirely a function of the state the first half just set, so Task 6's map subscribes to
 * `state.layers` and `state.opacity` instead of being poked. Nothing imperative is lost.
 */

import type { HTMLAttributes } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { useT } from '../app/I18nProvider';
import type { Spots } from '../app/data';
import { useAppState, type LayerKey, type State } from '../app/state';

/* Prototype lines 959-960: key, dictionary key, chip. The other chips are literal strings; the
 * original's `states` chip was the sentinel `'placeholder'`, swapped at render for
 * `T('placeholder')`.
 *
 * TASK 6 CHANGED THE `states` CHIP TO `37`. The chip said "placeholder" because the layer WAS
 * one: a `d3.geoGraticule` at 1.6 degree steps standing in for state boundaries. The user
 * approved real admin-level-1 boundaries from the vector basemap on 2026-10-24, reversing ruling
 * 31, so the layer now draws Nigeria's actual states - 36 of them plus the Federal Capital
 * Territory - and a chip reading "placeholder" would be the only thing on screen still lying
 * about it. `37` is a plain number like `441`, `55` and `1`, so this needs NO dictionary entry
 * and `src/i18n/` is untouched; `T('placeholder')` simply stops being reached from here. */
export const LAYER_ROWS: readonly { readonly key: LayerKey; readonly i18n: string; readonly chip: string }[] = [
  { key: 'spots', i18n: 'layer_spots', chip: '441' },
  { key: 'exag', i18n: 'layer_exag', chip: '' },
  { key: 'cities', i18n: 'layer_cities', chip: '55' },
  { key: 'states', i18n: 'layer_states', chip: '37' },
  { key: 'nation', i18n: 'layer_nation', chip: '1' },
  { key: 'labels', i18n: 'layer_labels', chip: '' },
];

/** Prototype lines 687-692, minus the sort (a count does not care about draw order). Unlike
 * `statSpots` this one honours `state.contour`, because the chip counts what is DRAWN. */
export function activeSpotCount(spots: Spots, state: State): number {
  return spots.features.filter((f) => {
    const p = f.properties;
    return (
      (state.contour === 'all' || p.contour_level === state.contour) &&
      (state.cluster === 'all' || String(p.cluster25) === state.cluster) &&
      (!state.city || p.city === state.city)
    );
  }).length;
}

/* Radix's Switch.Root is button-shaped: it injects `type="button"` and `value="on"`, which React
 * would write onto the div as invalid attributes. Slot lets the child's own props win even when
 * their value is `undefined`, so these clear both. The cast is needed because a div's prop type
 * has neither name - which is the point. */
const CLEAR_BUTTON_PROPS = { type: undefined, value: undefined } as unknown as HTMLAttributes<HTMLDivElement>;

export function Layers({ spots }: { readonly spots: Spots | null }) {
  const t = useT();
  const [state, patch] = useAppState();
  const pct = Math.round(state.opacity * 100);
  const liveSpotChip = spots ? String(activeSpotCount(spots, state)) : null;

  const toggle = (key: LayerKey) => patch({ layers: { ...state.layers, [key]: !state.layers[key] } });

  return (
    <div>
      <div className="sec-h">
        <span data-i18n="layers">{t('layers')}</span>
        <span id="opacityVal">{pct}%</span>
      </div>
      <div className="layers" id="layers">
        {LAYER_ROWS.map((row) => {
          const on = state.layers[row.key];
          const chip = row.chip === 'placeholder' ? t('placeholder') : row.key === 'spots' ? (liveSpotChip ?? row.chip) : row.chip;
          return (
            <Switch.Root key={row.key} asChild checked={on} onCheckedChange={() => toggle(row.key)}>
              <div
                className="ly"
                data-k={row.key}
                data-on={on}
                tabIndex={0}
                {...CLEAR_BUTTON_PROPS}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(row.key);
                  }
                }}
              >
                <span className="sw" />
                <span>{t(row.i18n)}</span>
                <span className="chip">{chip}</span>
              </div>
            </Switch.Root>
          );
        })}
      </div>
      {/* Native <input type=range>, NOT a Radix Slider. See the note in YearSlider.tsx. */}
      <input
        type="range"
        id="opacity"
        min={20}
        max={100}
        value={pct}
        style={{ marginTop: '6px' }}
        onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
      />
    </div>
  );
}
