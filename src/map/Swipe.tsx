/* The day/night swipe: the 2px handle, the two `.swipetag`s, and the clip the NIGHT map wears.
 * Replaces `initSwipe` and `positionSwipe` (prototype lines 827-850).
 *
 * RULING 35 IS WHY THIS FILE ONLY COMPUTES A CLIP AND DOES NOT APPLY ONE. The original clipped
 * two Leaflet panes - `dayPane` and `nightPane`, two separate DOM elements holding two separate
 * SVG overlays - with `clipPath: inset(...)`. MapLibre renders every layer into ONE canvas, so
 * there is nothing to clip that contains only the night spots. The decision was two synced map
 * instances, the night one stacked on top and CSS-clipped; see MapStage for the sync. This
 * component owns the number, MapStage owns the element.
 *
 * THE PIXEL MATH BECOMES PERCENTAGES, AND THAT REMOVES A WHOLE EVENT SUBSCRIPTION. The original
 * ran `positionSwipe` on `move zoom resize` (line 633) and recomputed three pixel offsets from
 * `wrap.clientWidth` each time, because a Leaflet pane is TRANSLATED by the map - the clip had
 * to be expressed in the pane's own moving coordinate space, hence the `off` correction on line
 * 844. Our clip target is a `position:absolute; inset:0` element that never moves relative to
 * `.mapwrap`, so every offset is a plain fraction of the wrap's width and can be written as a
 * percentage that the browser re-resolves on resize for free. `clip-path: inset()` takes
 * percentages of the reference box, and the reference box here IS `.mapwrap`'s - so
 * `inset(0 0 0 55%)` is exactly the original's `inset(0 0 0 Xpx)` with X = .55 * width.
 *
 * That is also why there is no resize listener and no `map.on('move')` for the swipe. If a
 * future change makes the clip target something that moves, the `off` correction comes back.
 */

import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../app/I18nProvider';
import { useInteractions } from './interactions';

/** Prototype line 828 and the `style="left:55%"` in the markup (line 362). */
export const SWIPE_DEFAULT = 0.55;
/** Prototype line 834: the handle never reaches either edge, so both tags stay readable. */
export const SWIPE_MIN = 0.08;
export const SWIPE_MAX = 0.92;
/** Prototype lines 842-843: each tag sits 10px clear of the handle. */
export const SWIPE_TAG_GAP = 10;

export const clampSwipe = (pct: number): number =>
  Number.isFinite(pct) ? Math.max(SWIPE_MIN, Math.min(SWIPE_MAX, pct)) : SWIPE_DEFAULT;

export interface SwipeGeometry {
  /** `#swipe`'s `left` (line 841). */
  readonly handleLeft: string;
  /** `#tagDay`'s `right`: the original's `(w - x + 10)px` (line 842). */
  readonly tagDayRight: string;
  /** `#tagNight`'s `left`: the original's `(x + 10)px` (line 843). */
  readonly tagNightLeft: string;
  /** The night instance's `clip-path`: the original's `inset(0 0 0 ${x}px)` on `nightPane`
   * (line 849). The day instance needs no clip - the night canvas is opaque, so it covers the
   * day one on its own side, which the original's pair of complementary clips also achieved. */
  readonly nightClip: string;
}

/** Prototype lines 838-850 as percentages. Pure: no DOM, no map, no width.
 *
 * The percentage is ROUNDED TO FOUR DECIMALS, which the original did not do: `(swipePct*100)`
 * on the default .55 is `55.00000000000001` in IEEE 754, and the original really did write that
 * string into `style.left`. Four decimals is well under a thousandth of a pixel on any viewport
 * - it cannot move anything - and it keeps the three strings this returns readable in a devtools
 * inspector and assertable in a test. */
export const swipePercent = (pct: number): number => Math.round(clampSwipe(pct) * 1e6) / 1e4;

export function swipeGeometry(pct: number): SwipeGeometry {
  const x = swipePercent(pct);
  return {
    handleLeft: `${x}%`,
    tagDayRight: `calc(${100 - x}% + ${SWIPE_TAG_GAP}px)`,
    tagNightLeft: `calc(${x}% + ${SWIPE_TAG_GAP}px)`,
    nightClip: `inset(0 0 0 ${x}%)`,
  };
}

/**
 * The handle and the two tags, transcribed from prototype lines 360-362.
 *
 * The drag is `setPointerCapture` as the original's was (line 831), which is what keeps the
 * handle tracking after the pointer leaves the 2px strip. `pointercancel` is handled too - the
 * original only listened for `pointerup`, so a cancelled gesture (a browser scroll takeover, a
 * palm rejection on a touchscreen) left `drag` true and the handle following the pointer with
 * no button down.
 */
export function Swipe() {
  const t = useT();
  const { swipePct, setSwipePct, nudgeSwipe } = useInteractions();
  const geom = swipeGeometry(swipePct);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      /* `hasPointerCapture` IS the drag flag. The original kept a `drag` boolean next to the
       * capture call; the capture state is the same fact without a second copy of it, and it
       * cannot get out of step with a lost or cancelled pointer. */
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const wrap = e.currentTarget.closest('.mapwrap');
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      setSwipePct((e.clientX - r.left) / r.width);
    },
    [setSwipePct],
  );

  const release = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <>
      <div className="swipetag" id="tagDay" style={{ right: geom.tagDayRight }}>
        {t('day')} · LST
      </div>
      <div className="swipetag" id="tagNight" style={{ left: geom.tagNightLeft }}>
        {t('night')} · LST
      </div>
      <div
        className="swipe"
        id="swipe"
        style={{ left: geom.handleLeft }}
        /* The original's handle is a bare div with pointer listeners and no role. It IS a
         * slider, and giving it the role plus arrow keys costs no pixel - the same argument
         * §9.1 bug 3 makes for the layer toggles, which Task 4 already acted on. */
        role="slider"
        tabIndex={0}
        aria-label={`${t('day')} / ${t('night')}`}
        aria-orientation="vertical"
        aria-valuemin={Math.round(SWIPE_MIN * 100)}
        aria-valuemax={Math.round(SWIPE_MAX * 100)}
        aria-valuenow={Math.round(clampSwipe(swipePct) * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        /* `nudgeSwipe`, not `setSwipePct(swipePct ± .02)`: React batches, so two key events in
         * one tick would both read the SAME captured `swipePct` and the second press would be
         * lost. A delta applied inside the state updater cannot be stale. */
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') nudgeSwipe(-0.02);
          else if (e.key === 'ArrowRight') nudgeSwipe(0.02);
          else return;
          e.preventDefault();
        }}
      >
        <div className="grab">⇄</div>
      </div>
    </>
  );
}
