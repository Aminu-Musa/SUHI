// @vitest-environment jsdom
/* `.seg` guards. The attribute this control renders IS its styling hook, so two of these tests
 * exist to catch a Radix upgrade quietly changing it.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode, useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Seg } from './Seg';

afterEach(cleanup);

const OPTIONS = [
  { value: 'all', label: 'All 441' },
  { value: 'L50', label: 'L50' },
  { value: 'L75', label: 'L75' },
  { value: 'L90', label: 'L90' },
];

const renderSeg = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('.seg button')];

/** A controlled host, because the component is controlled and a click that cannot change the
 * value would let an inert control pass the keyboard test. */
function Host({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('all');
  return (
    <Seg
      id="contourSeg"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

test('renders aria-pressed=true on exactly the active option', () => {
  renderSeg(<Seg id="contourSeg" options={OPTIONS} value="L75" onChange={() => {}} />);
  expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
  expect(buttons().map((b) => b.dataset.v)).toEqual(['all', 'L50', 'L75', 'L90']);
  expect(buttons().map((b) => b.textContent)).toEqual(['All 441', 'L50', 'L75', 'L90']);
});

test('keeps aria-pressed instead of the role=radio/aria-checked a single-type ToggleGroup would impose', () => {
  /* app.css styles `.seg button[aria-pressed=true]`. Radix's ToggleGroupItemImpl sets
   * role="radio", aria-checked and `aria-pressed: undefined` for type="single"; if an upgrade
   * ever stopped our child props from winning, the segment would render unselected in both
   * themes and no screenshot test would catch it. */
  renderSeg(<Seg id="contourSeg" options={OPTIONS} value="all" onChange={() => {}} />);
  for (const b of buttons()) {
    expect(b.hasAttribute('role')).toBe(false);
    expect(b.hasAttribute('aria-checked')).toBe(false);
    expect(b.hasAttribute('aria-pressed')).toBe(true);
  }
});

test('renders the buttons as direct children of .seg, because .seg is the flex container', () => {
  // asChild on Root and Item: a wrapper element would make `.seg{display:flex}` lay out one
  // child instead of four, which is a fidelity failure the box guard reports as a width diff.
  renderSeg(<Seg id="contourSeg" options={OPTIONS} value="all" onChange={() => {}} />);
  const seg = document.querySelector('.seg')!;
  expect(seg.tagName).toBe('DIV');
  expect(seg.id).toBe('contourSeg');
  expect([...seg.children].map((c) => c.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
});

test('passes an option style through to the button, for the basemap segment 10.5px', () => {
  renderSeg(
    <Seg
      id="baseSeg"
      options={[{ value: 'dark', label: 'Dark', style: { fontSize: '10.5px' } }]}
      value="dark"
      onChange={() => {}}
    />,
  );
  expect(buttons()[0].style.fontSize).toBe('10.5px');
});

test('is operable by keyboard', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderSeg(<Host onChange={onChange} />);

  /* One tab stop for the whole group - Radix's roving focus, which the original's four plain
   * buttons did not have. Arrow keys move focus; Enter activates. */
  await user.tab();
  expect(document.activeElement).toBe(buttons()[0]);
  expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);

  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(buttons()[1]);
  await user.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledWith('L50');
  expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);

  await user.keyboard('{ArrowLeft}{ }');
  expect(onChange).toHaveBeenLastCalledWith('all');
});

test('a second click on the pressed option is swallowed, because a segment always has one selection', async () => {
  /* Radix's single-type group reports '' when the pressed item is deactivated. The original's
   * handler could not produce that state - it only ever set aria-pressed on the clicked button -
   * so passing '' on would leave every option unpressed and the control styled as if nothing
   * were chosen. */
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderSeg(<Host onChange={onChange} />);
  await user.click(buttons()[0]);
  expect(onChange).not.toHaveBeenCalled();
  expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
});
