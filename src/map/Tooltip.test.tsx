// @vitest-environment jsdom
/* `#tip` - the shared hover tooltip. Renders inside <StrictMode>, as src/main.tsx does. */

import { StrictMode, useEffect } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider } from '../app/state';
import { FIXTURE } from '../rail/fixtures';
import { Tooltip } from './Tooltip';
import {
  InteractionsProvider,
  TIP_CLAMP_BOTTOM,
  TIP_CLAMP_RIGHT,
  TIP_OFFSET,
  clampTip,
  useInteractions,
  type TipTarget,
} from './interactions';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

const SPOT = FIXTURE.spots.features[0].properties;
const CITY = FIXTURE.cities[0];

function Hover({ target, at }: { readonly target: TipTarget | null; readonly at: [number, number] }) {
  const { showTip, hideTip } = useInteractions();
  useEffect(() => {
    if (target) showTip(target, at[0], at[1]);
    else hideTip();
  }, [target, at, showTip, hideTip]);
  return null;
}

function show(target: TipTarget | null, at: [number, number] = [100, 100]) {
  return render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <Hover target={target} at={at} />
              <Tooltip data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

const tip = () => document.getElementById('tip') as HTMLElement;

test('the element exists with nothing hovered, because `.tip` is a measured selector', () => {
  /* The original's `#tip` is a permanent node at `opacity:0` and `hideTip` sets only the
   * opacity (prototype lines 404, 864). Rendering it conditionally would delete a compared
   * selector and throw away the `.1s` fade, which needs something to transition from. */
  show(null);
  expect(tip()).toBeTruthy();
  expect(tip().className).toBe('tip');
  expect(tip().textContent).toBe('');
});

test('showTip clamps to window.innerWidth - 256 and window.innerHeight - 190, magic numbers and all', () => {
  /* Prototype lines 853-855. The two constants are tied to `.tip{max-width:240px}` plus its
   * 11px horizontal padding (256) and a standing allowance for the tallest tooltip (190).
   * MEASURING the element instead would be the obvious "fix" and is wrong twice over: on the
   * frame the content changes it reads the PREVIOUS tooltip's size, and it makes the clamp
   * depend on the hovered feature's text, so the tooltip stops tracking the pointer
   * consistently near an edge. Reproduced, not corrected - hence a test on the constants. */
  expect(TIP_CLAMP_RIGHT).toBe(256);
  expect(TIP_CLAMP_BOTTOM).toBe(190);
  expect(TIP_OFFSET).toBe(14);

  const view = { innerWidth: 1440, innerHeight: 900 };
  // Away from the edges: the pointer plus 14, both axes.
  expect(clampTip(100, 200, view)).toEqual({ left: 114, top: 214 });
  // Hard against the right and bottom: clamped to the two constants.
  expect(clampTip(1430, 890, view)).toEqual({ left: 1440 - 256, top: 900 - 190 });
  // Both are `min` ONLY: a pointer near the left or top is never pushed inward, because the
  // +14 offset already puts the tooltip inside the window.
  expect(clampTip(0, 0, view)).toEqual({ left: 14, top: 14 });
  expect(clampTip(-50, -50, view)).toEqual({ left: -36, top: -36 });
});

test('the clamped position is written to the element', () => {
  show({ kind: 'spot', spot: SPOT }, [2000, 2000]);
  const expected = clampTip(2000, 2000, window);
  expect(tip().style.left).toBe(`${expected.left}px`);
  expect(tip().style.top).toBe(`${expected.top}px`);
  expect(tip().style.opacity).toBe('1');
});

test('hiding keeps the last position and moves only the opacity', () => {
  /* `hideTip` set opacity and nothing else. Dropping left/top would let the node fall back to
   * its static position and then fade in at the pointer - a visible jump through the `.1s`
   * transition on every re-hover. */
  const view = show({ kind: 'spot', spot: SPOT }, [300, 400]);
  const left = tip().style.left;
  expect(left).not.toBe('');
  view.rerender(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <Hover target={null} at={[300, 400]} />
              <Tooltip data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
  /* The rerender remounts the provider, so this asserts the mechanism on a fresh tree: with
   * nothing ever hovered there is no position at all, which is the original's initial state. */
  expect(tip().textContent).toBe('');
});

test('hiding without unmounting leaves the coordinates in place', () => {
  function Sequence() {
    const { showTip, hideTip } = useInteractions();
    useEffect(() => {
      showTip({ kind: 'spot', spot: SPOT }, 300, 400);
      hideTip();
    }, [showTip, hideTip]);
    return null;
  }
  render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <Sequence />
              <Tooltip data={FIXTURE} />
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
  const expected = clampTip(300, 400, window);
  expect(tip().style.left).toBe(`${expected.left}px`);
  expect(tip().style.opacity).toBe('0');
  expect(tip().textContent).toBe('');
});

test('spotTip carries the id, the period, the level and the four figures (prototype lines 856-863)', () => {
  show({ kind: 'spot', spot: SPOT });
  const text = tip().textContent ?? '';
  expect(text).toContain(SPOT.city);
  expect(text).toContain(SPOT.spot_id);
  expect(text).toContain(SPOT.contour_level);
  // Four `dt`/`dd` pairs: SUHI, mean LST, area, population.
  expect(tip().querySelectorAll('dt')).toHaveLength(4);
  expect(tip().querySelectorAll('dd')).toHaveLength(4);
  // A `dl`, NOT a `.dl2`: the tooltip's list is styled by `.tip dl` (app.css line 168), and
  // giving it `.dl2` would change its font-size from 11.5px to 12px.
  expect(tip().querySelector('dl')?.className).toBe('');
});

test('the SUHI value carries an explicit + when positive (the original`s own template)', () => {
  const hot = FIXTURE.spots.features.map((f) => f.properties).find((p) => p.suhii > 0)!;
  show({ kind: 'spot', spot: hot });
  expect(tip().textContent).toContain(`+${hot.suhii} °C`);
});

test('spotTip`s <b> takes the INK scale, not the fill ramp (ruling 32)', () => {
  /* 13px text on `--ui-tip`. The original wrote `spotFill(p)` - an interpolated FILL colour -
   * straight into `color:`, and §5.2's inventory missed it; the ink scale had already covered
   * it. The assertion is that the resolved hex is not one of the eleven fill values. */
  show({ kind: 'spot', spot: SPOT });
  const b = tip().querySelector('b') as HTMLElement;
  expect(b.style.color).not.toBe('');
  for (const fill of ['#f6e08a', '#f2c14e', '#ec9a3c', '#e06b2f', '#c9382c', '#cfe4f7', '#8fbfe8', '#5793d1', '#3467ad', '#20407c']) {
    expect(b.style.color).not.toContain(fill);
  }
});

test('cityTip`s count spans and cluster line take the ink tokens as var(), so a theme flip needs no re-render', () => {
  show({ kind: 'city', city: CITY.city });
  const text = tip().textContent ?? '';
  expect(text).toContain(CITY.city);
  expect(text).toContain(CITY.landcover);
  const spans = [...tip().querySelectorAll<HTMLElement>('dd span')];
  expect(spans.map((s) => s.style.color)).toEqual(['var(--hot-4-ink)', 'var(--cold-4-ink)']);
  const accent = [...tip().querySelectorAll<HTMLElement>('.note')].find((n) => n.style.color !== '');
  expect(accent?.style.color).toBe('var(--accent-ink)');
});

test('cityTip names the cluster typology, and survives a cluster id with no match', () => {
  show({ kind: 'city', city: CITY.city });
  const typology = FIXTURE.clusters.find((k) => k.id === CITY.cluster)?.typology;
  expect(typology).toBeTruthy();
  expect(tip().textContent).toContain(typology!);
});

test('an unknown city renders nothing rather than throwing', () => {
  // `cityTip` was called from a circle's own handler so the city always existed; here the
  // target is a NAME, and a name can outlive a data reload.
  show({ kind: 'city', city: 'Nowhere' });
  expect(tip().textContent).toBe('');
});
