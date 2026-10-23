/* `.seg` - the original's segmented control, as a Radix ToggleGroup.
 *
 * The original was a plain `<div class="seg">` of `<button data-v aria-pressed>` whose click
 * handler walked its siblings setting aria-pressed (prototype lines 976-988). app.css styles
 * `.seg button[aria-pressed=true]`, so the attribute is not decoration: it IS the selected
 * state, and the fidelity guard measures the first `.seg button` in the document.
 *
 * THREE ATTRIBUTES ARE OVERRIDDEN ON PURPOSE. A `type="single"` ToggleGroup item renders
 * `role="radio"` + `aria-checked` and explicitly clears `aria-pressed`
 * (@radix-ui/react-toggle-group ToggleGroupItemImpl). That is defensible ARIA, but it is not
 * this design: the styling hook would vanish, every `[aria-pressed=true]` rule in app.css would
 * stop matching and the control would render unselected in both themes. Passing `role`,
 * `aria-checked` and `aria-pressed` on the child wins, because Slot lets the child's own props
 * override the ones the primitive injects. What Radix is still used for is the part the original
 * got wrong: roving focus, so the group is one tab stop with arrow-key movement.
 *
 * `asChild` on both Root and Item is load-bearing for fidelity - either one rendering its own
 * element would insert a wrapper div between `.seg` and its buttons, and `.seg{display:flex}`
 * would then lay out one child instead of five.
 *
 * Deselection is swallowed. Radix's single-type group reports `''` when the pressed item is
 * clicked again; the original's segments always keep exactly one option pressed, so an empty
 * value is dropped rather than passed on as "nothing selected".
 */

import type { CSSProperties, ReactNode } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

export interface SegOption {
  /** The original's `data-v`. */
  readonly value: string;
  readonly label: ReactNode;
  /** Inline overrides the original carries on the button itself (ruling 25's 10.5px). */
  readonly style?: CSSProperties;
}

export interface SegProps {
  /** The original's element id (`baseSeg`, `contourSeg`, `popSeg`, `metricSeg`). */
  readonly id: string;
  readonly options: readonly SegOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Inline style on the `.seg` element itself (`#metricSeg` has margin-bottom:4px). */
  readonly style?: CSSProperties;
}

export function Seg({ id, options, value, onChange, style }: SegProps) {
  return (
    <ToggleGroup.Root
      asChild
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      <div className="seg" id={id} style={style}>
        {options.map((o) => (
          <ToggleGroup.Item asChild key={o.value} value={o.value}>
            <button
              data-v={o.value}
              aria-pressed={o.value === value}
              role={undefined}
              aria-checked={undefined}
              style={o.style}
            >
              {o.label}
            </button>
          </ToggleGroup.Item>
        ))}
      </div>
    </ToggleGroup.Root>
  );
}
