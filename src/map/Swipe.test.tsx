// @vitest-environment jsdom
/* The day/night swipe (ruling 35). Renders inside <StrictMode>, as src/main.tsx does.
 *
 * The CLIP is the subject here, not the map: `swipeGeometry` is the whole of `positionSwipe`
 * (prototype lines 838-850) re-expressed as percentages, and the element it is applied to is
 * MapStage's night container. MapLibre is absent, which is exactly why the geometry is a pure
 * function - the original's version read `wrap.clientWidth` and a pane's bounding box, neither
 * of which exists without a rendered map.
 */

import { StrictMode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { ThemeProvider } from '../app/ThemeProvider';
import { I18nProvider } from '../app/I18nProvider';
import { AppStateProvider } from '../app/state';
import { InteractionsProvider } from './interactions';
import {
  SWIPE_DEFAULT,
  SWIPE_MAX,
  SWIPE_MIN,
  SWIPE_TAG_GAP,
  Swipe,
  clampSwipe,
  swipeGeometry,
  swipePercent,
} from './Swipe';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* unreachable unless a test left a throwing accessor installed */
  }
});

function show() {
  return render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <InteractionsProvider>
              <div className="mapwrap" id="mapwrap">
                <Swipe />
              </div>
            </InteractionsProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

const handle = () => document.getElementById('swipe') as HTMLElement;

test('the default is 55%, which is the inline style the original markup ships (line 362)', () => {
  expect(SWIPE_DEFAULT).toBe(0.55);
  show();
  expect(handle().style.left).toBe('55%');
});

test('the percentage is rounded, because 0.55 * 100 is not 55 in IEEE 754', () => {
  /* The original wrote `(swipePct*100)+'%'` and really did put `55.00000000000001%` into
   * `style.left` on first paint. Four decimals is under a thousandth of a pixel on any
   * viewport, so nothing moves; what it buys is a readable value and an assertable one. */
  expect(0.55 * 100).not.toBe(55);
  expect(swipePercent(0.55)).toBe(55);
  expect(swipePercent(0.3333)).toBe(33.33);
});

test('the handle is clamped to .08-.92 so neither tag is ever pushed off the stage', () => {
  expect(clampSwipe(0)).toBe(SWIPE_MIN);
  expect(clampSwipe(1)).toBe(SWIPE_MAX);
  expect(clampSwipe(-3)).toBe(SWIPE_MIN);
  expect(clampSwipe(0.4)).toBe(0.4);
  // NaN reaches here through `(clientX - r.left) / r.width` on a zero-width wrap; the original
  // had no guard and `Math.max(.08, Math.min(.92, NaN))` is NaN, which writes `left:NaN%`.
  expect(clampSwipe(Number.NaN)).toBe(SWIPE_DEFAULT);
});

test('the night clip is the original`s inset, expressed as a percentage of the same box', () => {
  /* `positionSwipe` set `clipPath: inset(0 0 0 ${x}px)` on `nightPane` with `x = pct * width`,
   * and it needed the pixel form because a Leaflet pane is TRANSLATED by the map - hence the
   * `off` correction on line 844. Our clip target is `position:absolute; inset:0` inside
   * `.mapwrap` and never moves, so the reference box IS `.mapwrap` and the percentage is
   * exactly the same cut. It also costs nothing on resize, which is why the original's
   * `map.on('move zoom resize', positionSwipe)` subscription is gone. */
  expect(swipeGeometry(0.55).nightClip).toBe('inset(0 0 0 55%)');
  expect(swipeGeometry(0.25).nightClip).toBe('inset(0 0 0 25%)');
  expect(swipeGeometry(0.5).nightClip).toBe('inset(0 0 0 50%)');
});

test('the two tags sit 10px clear of the handle, on opposite sides (lines 842-843)', () => {
  const g = swipeGeometry(0.3);
  expect(SWIPE_TAG_GAP).toBe(10);
  // `right: (w - x + 10)px` becomes `calc(70% + 10px)`; `left: (x + 10)px` becomes
  // `calc(30% + 10px)`. Same two offsets, no width needed.
  expect(g.tagDayRight).toBe('calc(70% + 10px)');
  expect(g.tagNightLeft).toBe('calc(30% + 10px)');
  expect(g.handleLeft).toBe('30%');
});

test('the geometry is clamped at the edges, so the clip can never invert', () => {
  for (const pct of [-1, 0, 0.5, 1, 2, Number.NaN]) {
    const g = swipeGeometry(pct);
    const x = Number(/([\d.]+)%/.exec(g.nightClip)![1]);
    expect(x).toBeGreaterThanOrEqual(SWIPE_MIN * 100);
    expect(x).toBeLessThanOrEqual(SWIPE_MAX * 100);
  }
});

test('dragging moves the handle, and the pointer capture is what keeps it tracking', () => {
  show();
  const el = handle();
  const wrap = document.getElementById('mapwrap') as HTMLElement;
  wrap.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  /* jsdom implements neither method, so they are installed here rather than mocked away: the
   * component uses `hasPointerCapture` AS its drag flag (the original kept a separate `drag`
   * boolean, which could get out of step with a lost or cancelled pointer), so without them
   * the move handler would return early and the test would pass having dragged nothing. */
  let captured = false;
  el.setPointerCapture = () => {
    captured = true;
  };
  el.releasePointerCapture = () => {
    captured = false;
  };
  el.hasPointerCapture = () => captured;

  // A move with no button down is ignored.
  act(() => {
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 300 });
  });
  expect(el.style.left).toBe('55%');

  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 550 });
  });
  expect(captured).toBe(true);
  act(() => {
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 300 });
  });
  expect(handle().style.left).toBe('30%');

  act(() => {
    fireEvent.pointerUp(el, { pointerId: 1 });
  });
  act(() => {
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 800 });
  });
  expect(handle().style.left).toBe('30%');
});

test('a cancelled gesture releases the drag, which the original`s pointerup-only listener did not', () => {
  /* `initSwipe` listened for `pointerdown`, `pointermove` and `pointerup` (lines 830-835). A
   * `pointercancel` - a browser scroll takeover, a palm rejection on a touchscreen - left
   * `drag` true, and the handle then followed the pointer with no button down. */
  show();
  const el = handle();
  const wrap = document.getElementById('mapwrap') as HTMLElement;
  wrap.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  let captured = false;
  el.setPointerCapture = () => {
    captured = true;
  };
  el.releasePointerCapture = () => {
    captured = false;
  };
  el.hasPointerCapture = () => captured;

  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 550 });
    fireEvent.pointerCancel(el, { pointerId: 1 });
  });
  expect(captured).toBe(false);
  act(() => {
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 100 });
  });
  expect(handle().style.left).toBe('55%');
});

test('the handle is a keyboard-operable slider, which costs no pixel', () => {
  /* The original's handle is a bare div with pointer listeners and no role - it IS a slider,
   * and §9.1 bug 3 makes the same argument about the layer toggles, which Task 4 acted on. */
  show();
  const el = handle();
  expect(el.getAttribute('role')).toBe('slider');
  expect(el.getAttribute('aria-orientation')).toBe('vertical');
  expect(el.getAttribute('aria-valuenow')).toBe('55');
  expect(el.tabIndex).toBe(0);
  act(() => {
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
  });
  expect(handle().style.left).toBe('53%');
  /* TWO presses in ONE batch, which is the case that catches a stale closure: with
   * `setSwipePct(swipePct + .02)` both handlers read the same captured value and the second
   * press is silently lost. */
  act(() => {
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    fireEvent.keyDown(el, { key: 'ArrowRight' });
  });
  expect(handle().getAttribute('aria-valuenow')).toBe('57');
});

test('the two tags and the 2px grab handle are the original`s markup', () => {
  show();
  expect(document.getElementById('tagDay')?.className).toBe('swipetag');
  expect(document.getElementById('tagNight')?.className).toBe('swipetag');
  expect(document.getElementById('tagDay')?.textContent).toContain('LST');
  expect(handle().className).toBe('swipe');
  expect(handle().querySelector('.grab')?.textContent).toBe('⇄');
});
