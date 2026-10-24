/* Spec §6.3's layer contract, as MapLibre expressions. Every rule in that table lives here and
 * nowhere else, so the paint is one readable unit instead of a style object with magic numbers.
 *
 * COLOURS ARE RESOLVED HEX, NOT `var(--x)`. MapLibre parses paint values once into a style
 * object; it never re-reads CSS, and it would take the literal string "var(--hot-4)" as an
 * unparseable colour. So every colour here comes from `THEME_TOKENS` at expression-build time
 * and every builder takes a `theme`. That is also what makes Task 7's repaint possible: a theme
 * change bumps `paintEpoch`, the map rebuilds these expressions and re-sets them.
 *
 * WHY EXPRESSIONS AND NOT A JS STYLE CALLBACK. The original re-ran `spotOpts().style` over 441
 * features on every zoom, filter change and year-slider tick (prototype lines 668-686, 722-737).
 * These evaluate on the GPU per frame instead, so the year slider and the opacity slider become
 * `setPaintProperty` and the contour filter becomes `setFilter`. The one thing that CANNOT
 * become an expression is the geometry exaggeration (ruling 9) - see `exaggerate.ts`.
 */

import { ENCODE_DOMAIN, ENCODE_FIELD } from '../lib/encode.mjs';
import { THEME_TOKENS } from '../../scripts/lib/tokens.mjs';
import type { Theme } from '../app/ThemeProvider';
import type { Contour } from '../app/state';

/* Any expression. The style spec's own `ExpressionSpecification` is a 40-way union whose
 * members are tuple types, so building one by `[...]` spread or `.flatMap` - which the ramp
 * below does - does not narrow to it without a cast at every site. These are handed straight to
 * MapLibre, which type-checks them properly at parse time, and `expressions.test.ts` parses
 * every one of them through the real style-spec parser, which is a stronger check than the
 * tuple types give. */
export type Expr = unknown[];

export const token = (theme: Theme, name: string): string => {
  const value = (THEME_TOKENS as Record<string, Record<string, string>>)[theme][name];
  if (!value) throw new Error(`unknown theme token ${name}`);
  return value;
};

/* Spec §6.2: `--cold-5 … --cold-1 · --neutral-mid · --hot-1 … --hot-5` over [-4.5, +4.5].
 * Eleven stops, evenly spaced, so `--neutral-mid` sits exactly on 0 - the midpoint has to be
 * the least salient point in both grounds, and an uneven spacing would slide it off zero. */
export const RAMP_TOKENS = [
  '--cold-5', '--cold-4', '--cold-3', '--cold-2', '--cold-1',
  '--neutral-mid',
  '--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5',
] as const;

/** The token spec §6.2 names for `lst_rel == null` and for the exact midpoint. */
export const NEUTRAL_MID = '--neutral-mid';

/** The eleven stop positions, in degrees C. Exported so the legend's ticks can read the domain
 * from the same place the paint does. */
export const RAMP_STOPS: readonly number[] = RAMP_TOKENS.map((_, i) => {
  const [lo, hi] = ENCODE_DOMAIN;
  return lo + (i * (hi - lo)) / (RAMP_TOKENS.length - 1);
});

/* Spec §6.3 outline colour: "warm stroke = hot-classified, cool stroke = cold-classified".
 * §6.3 names the encoding, not the tokens, and §5.7 picks them for us: --hot-4 (5.29 Nocturne /
 * 4.82 Modernist against the map ground) and --cold-3 (5.45 / 4.03) are the ONLY ramp pair that
 * clears the 3:1 non-text threshold in BOTH themes. Every darker member fails in Nocturne and
 * every lighter one fails in Modernist. They are also the pair the original already uses for
 * exactly this warm-vs-cool-at-a-glance job, in the city circles (prototype line 752). */
export const HOT_STROKE = '--hot-4';
export const COLD_STROKE = '--cold-3';

/** The original's fallback stroke, kept for a feature with neither class. */
export const SPOT_STROKE = '--spot-stroke';

/** Prototype line 2024 - the year `encodeValue`'s contract is fixed to (spec §10.1). */
export const BASE_YEAR = 2024;

/** Spec §6.3 / ruling 10, prototype line 674: `[.45, .72, 1][LEVEL_ORDER[contour_level]]`. */
export const NEST_OPACITY: Readonly<Record<string, number>> = { L50: 0.45, L75: 0.72, L90: 1 };

/**
 * RULING 12. The year slider back-casts the fill value from each spot's own Sen slope, and it
 * composes ON TOP of the encoding rather than inside it:
 *
 *   const v = encodeValue(props, refs);
 *   const display = v == null ? null : v - (2024 - year) / 10 * (props.sen_slope_C_per_decade ?? 0);
 *
 * `encodeValue` is NOT modified. Its contract is the 2024 value, and spec §10.1 promises that
 * swapping `lst_rel` for a Gi* z-score touches its body and nothing else; folding a year term
 * into it would break that promise and make the function's name a lie.
 *
 * As an expression that is a subtraction on `lst_rel`, and the null guard wraps THIS, not
 * `lst_rel` - see `spotFillExpression`. At year 2024 the factor is exactly 0, so the composed
 * value is `lst_rel` and the ramp is the plain encoding.
 */
export function composedValueExpression(year: number): Expr {
  return [
    '-',
    ['get', ENCODE_FIELD],
    ['*', (BASE_YEAR - year) / 10, ['coalesce', ['get', 'sen_slope_C_per_decade'], 0]],
  ];
}

/**
 * Spec §6.3 fill colour: `lst_rel` on the diverging ramp, back-cast by the year slider.
 *
 * THE `case` IS NOT DEFENSIVE PADDING - IT IS THE WHOLE POINT (Review Focus 1). `encodeValue`
 * returns `null` for 2 of today's 441 features (`Bida|night` and `Port Harcourt|night`: each is
 * its city's only L50 night contour and has a null `mean_lst`, so there is no reference mean to
 * subtract). A bare `['interpolate', …]` fed a null input does not error - it yields an
 * undefined paint value, which renders as a silently mis-coloured polygon. There is no louder
 * failure to notice. So the null is caught first and resolved to `--neutral-mid`, the colour
 * §6.2 already assigns to "no signal", and the guard wraps the COMPOSED value (ruling 12) so a
 * null cannot become a NaN by way of the subtraction either.
 *
 * CLAMPING IS `interpolate`'s OWN BEHAVIOUR (Review Focus 2), and is load-bearing rather than
 * incidental: observed `lst_rel` runs -5.95 to +6.65 against a ±4.5 domain, so about 5% of
 * spots sit outside it. `interpolate` returns the outermost stop for an input beyond the
 * outermost label - it does not extrapolate - which is exactly what §6.2's "clamped" asks for.
 * Pinned by a test, because it is a property of MapLibre rather than of this code.
 */
export function spotFillExpression(theme: Theme, year: number = BASE_YEAR): Expr {
  const stops = RAMP_TOKENS.flatMap((tok, i) => [RAMP_STOPS[i], token(theme, tok)]);
  return [
    'case',
    ['==', ['get', ENCODE_FIELD], null],
    token(theme, NEUTRAL_MID),
    ['interpolate', ['linear'], composedValueExpression(year), ...stops],
  ];
}

/**
 * Spec §6.3 fill opacity, ruling 10: `contour_level` multiplied by .45 / .72 / 1 for L50 / L75 /
 * L90, BUT ONLY WHILE THE CONTOUR FILTER IS `all`; then by the opacity slider.
 *
 * The condition looks like a bug and is not. L75 sits inside L50 and L90 inside L75, so with
 * every level drawn the three are stacked and the multipliers are what keeps the nesting
 * readable: a dark core inside a paler ring inside a paler ring. Filter to ONE level and there
 * is nothing to nest - applying .45 to a lone L50 layer would just render it faint for no
 * reason. Prototype lines 673-675.
 */
export function spotFillOpacityExpression(contour: Contour, opacity: number): Expr {
  const nest: Expr | number =
    contour === 'all'
      ? ['match', ['get', 'contour_level'], 'L50', NEST_OPACITY.L50, 'L75', NEST_OPACITY.L75, 'L90', NEST_OPACITY.L90, 1]
      : 1;
  return ['*', opacity, nest];
}

export interface SpotLineExpressions {
  readonly color: Expr;
  /** Ruling 11's weight, including the +0.4 for a non-significant spot. */
  readonly width: Expr;
  /** Ruling 11's `3 3`. A CONSTANT, not an expression - see below. */
  readonly dasharray: readonly [number, number];
}

/**
 * Spec §6.3's outline, ruling 11.
 *
 * COLOUR ENCODES `spot_type` AND REPLACES the original's "outline = fill colour when
 * significant" (prototype line 678). The two do NOT stack: if the stroke also carried magnitude
 * it would carry nothing, because it would equal the fill. §6.3 makes class the stroke's job
 * precisely so the ~13.7% of spots whose class and temperature disagree render as a warm fill
 * inside a cool outline and the reader SEES the tension instead of it being clamped away.
 *
 * WEIGHT is `2.2` below zoom 8, `1.6` below 11, else `1.1`, PLUS `0.4` when not significant.
 * `step` boundaries are inclusive-below, so 8 -> 1.6 and 11 -> 1.1, matching
 * `z<8?2.2:z<11?1.6:1.1` exactly.
 *
 * `['zoom']` HAS TO BE THE DIRECT INPUT OF A TOP-LEVEL `step`, so the `case` goes INSIDE each
 * branch rather than being added to the outside. The obvious shape -
 * `['+', ['step', ['zoom'], 2.2, 8, 1.6, 11, 1.1], ['case', …, 0, 0.4]]` - is what ruling 11
 * reads like and MapLibre REJECTS it outright: "zoom expression may only be used as input to a
 * top-level step or interpolate expression". It is a parse error, so the layer would have no
 * outline at all, and it was caught by parsing this expression through the real style-spec in
 * `expressions.test.ts` rather than in the browser. Hence `weight()` below: the +0.4 is written
 * once and applied to all three branches, so the two rules still have one home each.
 *
 * DASHARRAY IS A CONSTANT, AND THAT IS A CHOICE RATHER THAN A LIMIT - which is worth stating
 * because the obvious assumption is wrong in both directions. `line-dasharray` is
 * `cross-faded-data-driven` in this MapLibre, so `['case', ['get','bh_significant'], …]` DOES
 * parse and one line layer per period would be possible. It is not used, because a
 * cross-faded dasharray has no "no dash" value: solid has to be spelled `[1, 0]`, which is a
 * generated dash TEXTURE with a zero-length gap rather than a plain line, and the significant
 * spots - the majority, and the ones a reader is meant to trust - are the case that would be
 * carrying the hack. Two line layers over one source give the significant ones a real solid
 * stroke. `expressions.test.ts` pins the spec fact, so if a later MapLibre gains a genuine
 * no-dash value the merge is one layer away and the test says so.
 */
export function spotLineExpressions(theme: Theme): SpotLineExpressions {
  /* One rule, three branches: ruling 11's weight for a zoom band, plus 0.4 when the spot is not
   * BH-significant. A missing flag counts as not significant - the honest default for a claim
   * about statistical significance. */
  const weight = (base: number): Expr => [
    'case',
    ['==', ['get', 'bh_significant'], true],
    base,
    base + NONSIG_EXTRA,
  ];
  return {
    color: [
      'match',
      ['get', 'spot_type'],
      'hot', token(theme, HOT_STROKE),
      'cold', token(theme, COLD_STROKE),
      token(theme, SPOT_STROKE),
    ],
    width: [
      'step',
      ['zoom'],
      weight(OUTLINE_WEIGHTS.below8),
      8, weight(OUTLINE_WEIGHTS.below11),
      11, weight(OUTLINE_WEIGHTS.above),
    ],
    dasharray: [3, 3],
  };
}

/** Ruling 11's "plus 0.4 when not significant". */
export const NONSIG_EXTRA = 0.4;

/** Ruling 11's three zoom weights, keyed by the `step` boundary that introduces each. */
export const OUTLINE_WEIGHTS = { below8: 2.2, below11: 1.6, above: 1.1 } as const;

/** `bh_significant === true`, as a MapLibre filter. The two line layers are its two branches. */
export const SIGNIFICANT_FILTER: Expr = ['==', ['get', 'bh_significant'], true];
export const NOT_SIGNIFICANT_FILTER: Expr = ['!=', ['get', 'bh_significant'], true];

/**
 * `activeSpots`' predicate (prototype lines 687-692) as a MapLibre filter.
 *
 * This is where the original's `renderSpots()` / `clearLayers()` / `addData()` cycle goes: a
 * filter change is now one `setFilter` call against a source that never moves. `period` is part
 * of it because day and night are separate layers (separate panes in the original, lines
 * 615-616) so Task 7's swipe can clip one without touching the other.
 */
export function spotFilter(
  period: 'day' | 'night',
  contour: Contour,
  cluster: string,
  city: string | null,
): Expr {
  const clauses: Expr[] = [['==', ['get', 'period'], period]];
  if (contour !== 'all') clauses.push(['==', ['get', 'contour_level'], contour]);
  // `cluster25` is a NUMBER in the geojson while state.cluster is a string; the original
  // bridges that with String(p.cluster25) at every comparison (prototype line 683).
  if (cluster !== 'all') clauses.push(['==', ['to-string', ['get', 'cluster25']], cluster]);
  if (city) clauses.push(['==', ['get', 'city'], city]);
  return ['all', ...clauses];
}
