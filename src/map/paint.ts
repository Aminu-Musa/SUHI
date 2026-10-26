/* The spot layers as DATA: which layers exist, what paint each carries, and which of those
 * properties go stale when the theme changes.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES INSIDE MapStage. Review Focus 4 is a repaint bug, and
 * the shape of a repaint bug is always the same: a paint property is set when the layer is
 * CREATED and forgotten when the theme changes. The two code paths drift because they are two
 * code paths. Here there is one - `layerPaint` is what `addLayer` receives and `repaintPatch` is
 * what `setPaintProperty` re-sets - and `theme-repaint.test.ts` asserts that no property whose
 * value depends on the theme is missing from the second. MapLibre does not run in jsdom, so the
 * derivation is where the test can reach, and it is also where the bug lives.
 *
 * Ruling 35 makes this per-INSTANCE as well as per-layer: each of the two maps carries one
 * period's three layers, so "every layer repainted" means both instances or it means nothing.
 */

import type { Theme } from '../app/ThemeProvider';
import type { Contour } from '../app/state';
import {
  NOT_SIGNIFICANT_FILTER,
  SIGNIFICANT_FILTER,
  spotFillExpression,
  spotFillOpacityExpression,
  spotFilter,
  spotLineExpressions,
  type Expr,
} from './expressions';

export const SPOT_SOURCE = 'spots';

/** Day under night, as the original's panes were (dayPane 420, nightPane 421) - and now as two
 * stacked instances, which is the same order by a different mechanism (ruling 35). */
export const PERIODS = ['day', 'night'] as const;
export type Period = (typeof PERIODS)[number];

export const fillLayerId = (p: Period) => `spots-${p}-fill`;
export const lineLayerId = (p: Period, significant: boolean) => `spots-${p}-line-${significant ? 'sig' : 'nonsig'}`;

/** One period's three layers: the fill, plus the two line layers the dasharray split forces. */
export const periodLayers = (p: Period): readonly string[] => [
  fillLayerId(p),
  lineLayerId(p, true),
  lineLayerId(p, false),
];

/** Every layer `state.layers.spots` switches, across both instances. */
export const SPOT_LAYERS: readonly string[] = PERIODS.flatMap((p) => periodLayers(p));

export interface OverlayLayer {
  readonly id: string;
  readonly period: Period;
  readonly type: 'fill' | 'line';
  /** `null` for the fill layer; the two line layers are the two branches of the dash split. */
  readonly significant: boolean | null;
}

/** The six layers this app adds, three per instance, in the order they are added. */
export function overlayLayers(): readonly OverlayLayer[] {
  return PERIODS.flatMap((period): OverlayLayer[] => [
    { id: fillLayerId(period), period, type: 'fill', significant: null },
    { id: lineLayerId(period, true), period, type: 'line', significant: true },
    { id: lineLayerId(period, false), period, type: 'line', significant: false },
  ]);
}

/** The slice of app state the paint reads. Narrow on purpose: a wider type would let an
 * unrelated state change look like a repaint trigger. */
export interface PaintState {
  readonly year: number;
  readonly contour: Contour;
  readonly opacity: number;
}

/**
 * THE PAINT PROPERTIES WHOSE VALUES COME FROM THEME TOKENS, and therefore the ones a theme
 * change invalidates. MapLibre bakes resolved hex into its parsed style and never re-reads CSS,
 * so these are exactly the properties that cannot be left to the cascade.
 *
 * This list is not used to DRIVE anything - `repaintPatch` re-sets more than this, because
 * re-setting a property that has not changed is free. It is here so the test can ask the
 * question the other way round: of every property that actually differs between two themes,
 * is each one in the repaint pass?
 */
export const THEME_DEPENDENT_PAINT: readonly string[] = ['fill-color', 'line-color'];

/** The FULL paint for one layer: what `addLayer` is given. */
export function layerPaint(layer: OverlayLayer, theme: Theme, state: PaintState): Record<string, unknown> {
  if (layer.type === 'fill') {
    return {
      'fill-color': spotFillExpression(theme, state.year),
      'fill-opacity': spotFillOpacityExpression(state.contour, state.opacity),
    };
  }
  const line = spotLineExpressions(theme);
  return {
    'line-color': line.color,
    'line-width': line.width,
    /* The dash is on the NON-significant layer only, and it is a constant - see
     * `spotLineExpressions` for why there are two line layers rather than one data-driven
     * dasharray. Being a constant it is also theme-independent, which is why the repaint pass
     * leaves it alone and the test below does not demand it. */
    ...(layer.significant ? {} : { 'line-dasharray': [...line.dasharray] }),
  };
}

/** What a theme change (or a year / contour / opacity change) re-sets through
 * `setPaintProperty`. A SUBSET of `layerPaint` by construction - never a different value. */
export function repaintPatch(layer: OverlayLayer, theme: Theme, state: PaintState): Record<string, unknown> {
  const full = layerPaint(layer, theme, state);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(full)) {
    // Constants are skipped: a dasharray that cannot change does not need re-setting, and
    // `line-dasharray` is cross-faded, so re-setting it would restart the cross-fade.
    if (key === 'line-dasharray') continue;
    patch[key] = full[key];
  }
  return patch;
}

/** The layer's filter: period, plus the contour/cluster/city scope, plus the dash split. */
export function layerFilter(
  layer: OverlayLayer,
  contour: Contour,
  cluster: string,
  city: string | null,
): Expr {
  const base = spotFilter(layer.period, contour, cluster, city);
  if (layer.significant === null) return base;
  return ['all', base, layer.significant ? SIGNIFICANT_FILTER : NOT_SIGNIFICANT_FILTER];
}
