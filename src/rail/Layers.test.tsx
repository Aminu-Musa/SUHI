// @vitest-environment jsdom
/* Layer-toggle and opacity-slider guards - rail group 6.
 *
 * The load-bearing test is "switching language leaves every toggle state unchanged" (Review
 * Focus 3 / spec §9.1 bug 2). The original's `buildRail` hard-coded `data-on="true"` on every
 * row AND was re-called from the language picker, so choosing Hausa silently reset all six
 * switches' visuals while `state.layers` kept the real values. That is the single most likely
 * thing to regress in a React rewrite - any future "re-render the rail on language change"
 * shortcut that reintroduces a second copy of the truth fails this test.
 *
 * Every render goes through <StrictMode>, as src/main.tsx does (standing rule from Task 2).
 */

import { StrictMode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { FIXTURE } from './fixtures';
import { LAYER_ROWS, activeSpotCount } from './Layers';
import { INITIAL_STATE, type State } from '../app/state';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
});

const renderApp = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const mount = (initialState: Partial<State> = {}) =>
  renderApp(<App data={FIXTURE} initialState={initialState} />);

const rows = () => [...document.querySelectorAll<HTMLElement>('.ly')];
const dataOn = () => rows().map((r) => r.dataset.on);
const ariaChecked = () => rows().map((r) => r.getAttribute('aria-checked'));
const byId = (id: string) => document.getElementById(id)!;
const chips = () => rows().map((r) => r.querySelector('.chip')?.textContent ?? null);

describe('markup', () => {
  test('six rows in the original order, each .sw + label + .chip', () => {
    mount();
    expect(rows().length).toBe(6);
    expect(rows().map((r) => r.dataset.k)).toEqual(['spots', 'exag', 'cities', 'states', 'nation', 'labels']);
    expect(rows().map((r) => r.className)).toEqual(Array(6).fill('ly'));
    // The switch knob and the chip are both present on every row, and in that order.
    for (const r of rows()) {
      expect(r.children.length).toBe(3);
      expect(r.children[0].className).toBe('sw');
      expect(r.children[2].className).toBe('chip');
    }
    expect(byId('layers').className).toBe('layers');
    expect(rows().map((r) => r.children[1].textContent)).toEqual([
      'Hot & cold spots',
      'Scale small spots to visible',
      'City centres',
      'State boundaries',
      'National boundary',
      'City labels',
    ]);
  });

  test('two chips are deliberately EMPTY, and the empty pill still renders', () => {
    /* `exag` and `labels` carry '' in the original (prototype line 959). The span, its border
     * and its padding are still there and visible in both themes; removing the element because
     * it has no text would be a design change. */
    mount();
    expect(chips()).toEqual([String(441), '', '55', '37', '1', '']);
    for (const r of rows()) expect(r.querySelector('.chip')).not.toBeNull();
  });

  test('the states chip reads 37, not "placeholder", because the layer is no longer one', () => {
    /* The original's chip was the sentinel `'placeholder'`, rendered through `T('placeholder')`,
     * because the "State boundaries" layer was a 1.6 degree graticule standing in for the real
     * thing. The user approved the vector basemap's admin-level-1 boundaries on 2026-10-24
     * (reversing ruling 31), so the layer draws Nigeria's 36 states plus the Federal Capital
     * Territory. A chip still reading "placeholder" would be the only thing on screen lying
     * about what is drawn. `37` is a plain number like the other chips, so no dictionary entry
     * was added and src/i18n is untouched - which is also why this test asserts the LITERAL and
     * not a translation. */
    mount();
    expect(LAYER_ROWS.find((r) => r.key === 'states')!.chip).toBe('37');
    const states = rows().find((r) => (r as HTMLElement).dataset.k === 'states')!;
    expect(states.querySelector('.chip')!.textContent).toBe('37');
    // And it stays 37 in every language, exactly as 441 / 55 / 1 do.
    for (const lang of ['ha', 'ig', 'yo']) {
      cleanup();
      mount();
      (document.getElementById('lang') as HTMLSelectElement).value = lang;
      expect(chips()[3]).toBe('37');
    }
  });

  test('the spots chip is LIVE, tracking the contour filter rather than the literal 441', () => {
    /* `renderSpots` overwrote it with the drawn count (prototype lines 724, 735), which equals
     * the markup's literal only because the default filter selects everything. */
    expect(activeSpotCount(FIXTURE.spots, INITIAL_STATE)).toBe(441);
    mount({ contour: 'L50' });
    expect(chips()[0]).toBe('185');
    expect(activeSpotCount(FIXTURE.spots, { ...INITIAL_STATE, contour: 'L50' })).toBe(185);
  });

  test('every LAYER_ROWS key is a real state.layers key', () => {
    for (const r of LAYER_ROWS) expect(Object.hasOwn(INITIAL_STATE.layers, r.key)).toBe(true);
    expect(LAYER_ROWS.length).toBe(Object.keys(INITIAL_STATE.layers).length);
  });
});

describe('spec §9.1 bug 2 - data-on comes from state', () => {
  test('each layer toggle reflects state.layers, not a hardcoded attribute', () => {
    /* The original wrote data-on="true" on all six rows unconditionally, so seeding a false
     * layer and finding "true" on screen is exactly the bug. */
    mount({ layers: { spots: false, exag: false, cities: false, states: false, nation: false, labels: false } });
    expect(dataOn()).toEqual(Array(6).fill('false'));
    expect(ariaChecked()).toEqual(Array(6).fill('false'));

    cleanup();
    mount({ layers: { spots: true, exag: false, cities: true, states: false, nation: true, labels: false } });
    expect(dataOn()).toEqual(['true', 'false', 'true', 'false', 'true', 'false']);
    expect(ariaChecked()).toEqual(['true', 'false', 'true', 'false', 'true', 'false']);
  });

  test('clicking a row toggles only that row', async () => {
    const user = userEvent.setup();
    mount();
    expect(dataOn()).toEqual(Array(6).fill('true'));
    await user.click(rows()[2]);
    expect(dataOn()).toEqual(['true', 'true', 'false', 'true', 'true', 'true']);
    await user.click(rows()[2]);
    expect(dataOn()).toEqual(Array(6).fill('true'));
  });

  test('switching language leaves every toggle state unchanged', async () => {
    /* REVIEW FOCUS 3. Flip all six away from their defaults, then change the language picker -
     * the exact sequence that reset the original's switches, because `buildRail` rebuilt the
     * rows from a literal instead of from state. */
    const user = userEvent.setup();
    mount();
    for (const r of rows()) await user.click(r);
    expect(dataOn()).toEqual(Array(6).fill('false'));
    expect(ariaChecked()).toEqual(Array(6).fill('false'));

    await user.selectOptions(byId('lang'), 'ha');
    // The language really did change - otherwise this test could pass having done nothing.
    expect(rows()[0].children[1].textContent).toBe('Wuraren zafi da sanyi');
    expect(document.documentElement.lang).toBe('ha');

    expect(dataOn()).toEqual(Array(6).fill('false'));
    expect(ariaChecked()).toEqual(Array(6).fill('false'));

    // And again, to a third language, with a mixed state this time.
    await user.click(rows()[1]);
    await user.click(rows()[4]);
    const before = dataOn();
    expect(before).toEqual(['false', 'true', 'false', 'false', 'true', 'false']);
    await user.selectOptions(byId('lang'), 'yo');
    expect(rows()[0].children[1].textContent).toBe('Ibi gbóná àti tútù');
    expect(dataOn()).toEqual(before);
    expect(ariaChecked()).toEqual(['false', 'true', 'false', 'false', 'true', 'false']);
  });
});

describe('spec §9.1 bug 3 - the toggles are reachable and readable', () => {
  test('toggles are role=switch with aria-checked and keyboard-operable', async () => {
    /* The original's rows were `<div onclick>`: not focusable, no role, no state exposed. */
    const user = userEvent.setup();
    mount();
    for (const r of rows()) {
      expect(r.getAttribute('role')).toBe('switch');
      expect(r.getAttribute('aria-checked')).toBe('true');
      expect(r.tabIndex).toBe(0);
    }

    // Space toggles.
    rows()[0].focus();
    expect(document.activeElement).toBe(rows()[0]);
    await user.keyboard(' ');
    expect(dataOn()[0]).toBe('false');
    expect(rows()[0].getAttribute('aria-checked')).toBe('false');

    // So does Enter, and neither touches a sibling.
    rows()[3].focus();
    await user.keyboard('{Enter}');
    expect(dataOn()).toEqual(['false', 'true', 'true', 'false', 'true', 'true']);
  });

  test('a div child keeps the .ly markup, so no button chrome and no stray button attributes', () => {
    /* Radix Switch.Root is button-shaped. A <button> child would bring UA border, background
     * and centred text that app.css never resets - a visible fidelity break - and its injected
     * `type`/`value` would land on the element as invalid attributes. */
    mount();
    for (const r of rows()) {
      expect(r.tagName).toBe('DIV');
      expect(r.hasAttribute('type')).toBe(false);
      expect(r.hasAttribute('value')).toBe(false);
    }
  });
});

describe('the opacity slider', () => {
  test('opacity slider updates the percentage label', () => {
    mount();
    const op = byId('opacity') as HTMLInputElement;
    expect(op.type).toBe('range');
    expect(op.min).toBe('20');
    expect(op.max).toBe('100');
    expect(op.value).toBe('85');
    expect(byId('opacityVal').textContent).toBe('85%');

    /* The thumb cannot be dragged in jsdom, so the change is fired directly - which is what a
     * drag produces anyway. `fireEvent.change` rather than a hand-built event: React installs
     * its own `value` setter to dedupe change events, so assigning `op.value` and dispatching
     * `input` by hand updates React's tracked value FIRST and the handler is then skipped as a
     * no-op. The test would pass against a slider wired to nothing. */
    fireEvent.change(op, { target: { value: '40' } });
    expect(byId('opacityVal').textContent).toBe('40%');
    expect((byId('opacity') as HTMLInputElement).value).toBe('40');
  });

  test('state.opacity is the 0-1 FRACTION while the slider is 20-100', () => {
    /* Not a rounding choice: `state.opacity` feeds Leaflet's fillOpacity, and the original
     * divided by 100 in the handler (prototype line 991). A later task reading state.opacity
     * as a percentage would make every polygon opaque. */
    mount({ opacity: 0.2 });
    expect((byId('opacity') as HTMLInputElement).value).toBe('20');
    expect(byId('opacityVal').textContent).toBe('20%');
  });

  test('the slider is a native input[type=range], which the fidelity guard measures', () => {
    /* A Radix Slider renders spans: `input[type=range]` would then be absent from the rebuild
     * and the fidelity guard fails on it outright. The native control is also already
     * role=slider, a tab stop and arrow-operable, so there is no accessibility reason to
     * replace it. See the note at the head of YearSlider.tsx. */
    mount();
    const ranges = [...document.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(ranges.map((r) => r.id)).toEqual(['opacity', 'year']);
    expect(ranges[0].getAttribute('role')).toBeNull(); // the UA supplies role=slider
  });
});
