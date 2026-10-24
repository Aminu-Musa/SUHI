/* Spec §6.3's layer contract, asserted by EVALUATING the real expressions.
 *
 * WHY THE REAL PARSER AND NOT A SHAPE ASSERTION. MapLibre does not run in jsdom - it needs a
 * WebGL context - so the brief's rule is to test the expressions as pure functions and not to
 * mock a map into a fake integration test. The expressions are data, though, and
 * `@maplibre/maplibre-gl-style-spec` is the same parser and the same evaluator MapLibre itself
 * uses, shipped as a node-safe module (it is maplibre-gl's own dependency; pinned here
 * explicitly as a devDependency rather than borrowed by hoisting). So every expression below is
 * really parsed against the real property specification and really evaluated against a feature.
 * A shape assertion - "the array starts with 'case'" - would have passed for every one of the
 * three bugs these tests exist to catch.
 *
 * Parsing is itself an assertion: `createPropertyExpression` rejects a type error, a bad arity
 * and an unknown operator, so `parse()` throwing names the mistake for us.
 */

import { createPropertyExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, test } from 'vitest';
import { ENCODE_DOMAIN, buildReferenceMeans, encodeValue } from '../lib/encode.mjs';
import { THEME_TOKENS } from '../../scripts/lib/tokens.mjs';
import type { Theme } from '../app/ThemeProvider';
import {
  BASE_YEAR,
  COLD_STROKE,
  HOT_STROKE,
  NEST_OPACITY,
  NEUTRAL_MID,
  RAMP_STOPS,
  RAMP_TOKENS,
  composedValueExpression,
  spotFillExpression,
  spotFillOpacityExpression,
  spotFilter,
  spotLineExpressions,
  token,
  type Expr,
} from './expressions';

type Props = Record<string, unknown>;

/** Parse one expression exactly as MapLibre would, for the named paint property. */
function parse(expr: Expr, layerType: 'fill' | 'line', property: string) {
  const spec = (latest as unknown as Record<string, Record<string, unknown>>)[`paint_${layerType}`][property];
  const r = createPropertyExpression(expr as never, property, spec as never);
  if (r.result === 'error') throw new Error(`${property}: ${r.value.map((e) => e.message).join('; ')}`);
  return (props: Props, zoom = 6) => r.value.evaluate({ zoom } as never, { properties: props, type: 'Polygon' } as never);
}

const fillColor = (theme: Theme, year = BASE_YEAR) => parse(spotFillExpression(theme, year), 'fill', 'fill-color');
const hex = (v: unknown): string => String(v);

const THEMES: Theme[] = ['nocturne', 'modernist'];

describe('fill colour - spec §6.2', () => {
  test('null lst_rel resolves to the neutral midpoint, not an interpolate error (Review Focus 1)', () => {
    /* THE FAILURE THIS CATCHES IS SILENT. `encodeValue` returns null for 2 of today's 441
     * features, and a bare `['interpolate', …]` fed null does not throw - it yields an
     * undefined paint value and the polygon renders mis-coloured with nothing in the console.
     * The `case` is the only thing standing between that and a wrong map. */
    for (const theme of THEMES) {
      const f = fillColor(theme);
      expect(hex(f({ lst_rel: null }))).toBe(hex(f({ lst_rel: null })));
      const neutral = token(theme, NEUTRAL_MID);
      // Color#toString is rgb(); compare against the same ramp stop evaluated through the same
      // evaluator rather than against the hex string, so the comparison is apples to apples.
      const atZero = f({ lst_rel: 0 });
      expect(hex(f({ lst_rel: null }))).toBe(hex(atZero));
      expect(neutral).toBe(theme === 'nocturne' ? '#3f424d' : '#bab6b6');
    }
  });

  test('a missing lst_rel property is also the neutral midpoint, not a crash', () => {
    // geojson-vt may omit a null-valued property altogether, in which case `['get']` returns
    // null as well. Both roads have to arrive at the same colour.
    for (const theme of THEMES) {
      const f = fillColor(theme);
      expect(hex(f({}))).toBe(hex(f({ lst_rel: null })));
      // Against the neutral STOP, not just against each other: without the `case` both roads
      // produce the same undefined value and an equality-only assertion would still pass.
      expect(hex(f({}))).toBe(hex(f({ lst_rel: 0 })));
    }
  });

  test('the null guard wraps the COMPOSED value, so a back-cast cannot turn null into NaN (ruling 12)', () => {
    /* If the guard were inside the interpolate instead of around the whole thing, subtracting
     * the Sen-slope term from null would give -0 or NaN depending on coercion, and the feature
     * would silently leave the neutral colour. */
    for (const theme of THEMES) {
      const f = fillColor(theme, 1990);
      expect(hex(f({ lst_rel: null, sen_slope_C_per_decade: 2.4 }))).toBe(hex(fillColor(theme)({ lst_rel: 0 })));
    }
  });

  test('values beyond ±4.5 clamp to the ramp ends rather than extrapolating (Review Focus 2)', () => {
    /* Observed `lst_rel` runs -5.95 to +6.65 against a ±4.5 domain, so about 5% of spots sit
     * outside it and would paint an invented colour if `interpolate` extrapolated. It does not -
     * it returns the outermost stop - but that is a property of MapLibre rather than of this
     * code, which is exactly why it is pinned here. */
    for (const theme of THEMES) {
      const f = fillColor(theme);
      expect(hex(f({ lst_rel: -5.95 }))).toBe(hex(f({ lst_rel: ENCODE_DOMAIN[0] })));
      expect(hex(f({ lst_rel: 6.65 }))).toBe(hex(f({ lst_rel: ENCODE_DOMAIN[1] })));
      // And both ends really are the extreme tokens, not merely equal to each other.
      expect(hex(f({ lst_rel: -5.95 }))).not.toBe(hex(f({ lst_rel: 6.65 })));
    }
  });

  test('the fill ramp uses the FILL tokens in diverging order, cold-5 to hot-5 over [-4.5, 4.5]', () => {
    expect([...RAMP_TOKENS]).toEqual([
      '--cold-5', '--cold-4', '--cold-3', '--cold-2', '--cold-1',
      '--neutral-mid',
      '--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5',
    ]);
    // Eleven evenly spaced stops with the neutral midpoint exactly on zero - §6.2 makes "no
    // signal should recede" a positional claim, so an uneven spacing would break the encoding.
    expect(RAMP_STOPS[0]).toBe(ENCODE_DOMAIN[0]);
    expect(RAMP_STOPS[RAMP_STOPS.length - 1]).toBe(ENCODE_DOMAIN[1]);
    expect(RAMP_STOPS[5]).toBe(0);
    expect(RAMP_TOKENS[5]).toBe(NEUTRAL_MID);
    // NOT the -ink scale. Ink exists for ramp colours used as TEXT (§5.4); a fill is the colour.
    for (const t of RAMP_TOKENS) expect(t.endsWith('-ink')).toBe(false);
    for (const theme of THEMES) {
      const f = fillColor(theme);
      for (let i = 0; i < RAMP_TOKENS.length; i++) {
        const want = createPropertyExpression(token(theme, RAMP_TOKENS[i]) as never, 'fill-color', (latest as unknown as Record<string, Record<string, unknown>>).paint_fill['fill-color'] as never);
        if (want.result === 'error') throw new Error('token is not a parseable colour');
        const expected = want.value.evaluate({ zoom: 6 } as never, { properties: {}, type: 'Polygon' } as never);
        expect(hex(f({ lst_rel: RAMP_STOPS[i] }))).toBe(hex(expected));
      }
    }
  });

  test('every ramp token is six-digit hex, because MapLibre cannot read var(--x)', () => {
    for (const theme of THEMES) {
      for (const t of [...RAMP_TOKENS, HOT_STROKE, COLD_STROKE]) {
        expect(token(theme, t)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('the year back-cast - ruling 12', () => {
  test('the year slider back-casts the encoded value by the Sen slope, outside encodeValue', () => {
    const v = parse(composedValueExpression(1994) as Expr, 'fill', 'fill-opacity');
    // (2024 - 1994) / 10 = 3 decades, so 3 x the slope is subtracted.
    expect(v({ lst_rel: 2, sen_slope_C_per_decade: 0.5 })).toBeCloseTo(2 - 1.5, 10);
    expect(v({ lst_rel: -1, sen_slope_C_per_decade: -0.2 })).toBeCloseTo(-1 + 0.6, 10);
  });

  test('at 2024 the back-cast term is exactly zero, so the ramp is the plain encoding', () => {
    const v = parse(composedValueExpression(BASE_YEAR) as Expr, 'fill', 'fill-opacity');
    expect(v({ lst_rel: 3.25, sen_slope_C_per_decade: 9 })).toBe(3.25);
  });

  test('a missing sen_slope is coalesced to 0, not to null (prototype used `|| 0`)', () => {
    const v = parse(composedValueExpression(1990) as Expr, 'fill', 'fill-opacity');
    expect(v({ lst_rel: 1 })).toBe(1);
    expect(v({ lst_rel: 1, sen_slope_C_per_decade: null })).toBe(1);
  });

  test('encodeValue is NOT given the year: its contract is the 2024 value (spec §10.1)', () => {
    /* §10.1 promises that swapping lst_rel for a Gi* z-score touches encodeValue's body and
     * nothing else. Folding a year term into it would break that promise, so the arity is the
     * guard: (props, refs), never (props, refs, year). */
    expect(encodeValue.length).toBe(2);
    const refs = buildReferenceMeans([
      { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: 10 } },
      { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: 12 } },
    ] as never);
    expect(encodeValue({ city: 'X', period: 'day', mean_lst: 13 } as never, refs)).toBe(2);
  });
});

describe('fill opacity - ruling 10', () => {
  const nest = (contour: 'all' | 'L50', opacity: number) =>
    parse(spotFillOpacityExpression(contour, opacity) as Expr, 'fill', 'fill-opacity');

  test('fill opacity applies the .45/.72/1 nesting multipliers only when contour is all', () => {
    /* The condition reads like a bug. It is what keeps three NESTED levels readable: L90 sits
     * inside L75 inside L50, so with all three drawn the multipliers make a dark core inside a
     * paler ring inside a paler ring. Filter to one level and there is nothing to nest, so
     * applying .45 would just render a lone L50 layer faint for no reason. */
    const all = nest('all', 0.85);
    expect(all({ contour_level: 'L50' })).toBeCloseTo(0.85 * NEST_OPACITY.L50, 10);
    expect(all({ contour_level: 'L75' })).toBeCloseTo(0.85 * NEST_OPACITY.L75, 10);
    expect(all({ contour_level: 'L90' })).toBeCloseTo(0.85 * NEST_OPACITY.L90, 10);

    const one = nest('L50', 0.85);
    for (const lvl of ['L50', 'L75', 'L90']) expect(one({ contour_level: lvl })).toBeCloseTo(0.85, 10);
  });

  test('the multipliers are the original`s [.45, .72, 1] indexed by LEVEL_ORDER', () => {
    expect(NEST_OPACITY).toEqual({ L50: 0.45, L75: 0.72, L90: 1 });
  });

  test('the opacity slider multiplies on top, and 0.2 is its floor (the rail`s min)', () => {
    expect(nest('all', 0.2)({ contour_level: 'L90' })).toBeCloseTo(0.2, 10);
    expect(nest('all', 1)({ contour_level: 'L50' })).toBeCloseTo(0.45, 10);
  });
});

describe('the outline - spec §6.3 and ruling 11', () => {
  test('outline colour encodes spot_type, not magnitude, and does not stack with the fill', () => {
    /* §6.3 REPLACES the original's "outline = fill colour when significant". If the stroke also
     * carried magnitude it would carry nothing, because it would equal the fill - and the ~13.7%
     * of spots whose class and temperature disagree would stop being visible, which is the
     * entire reason §6.3 moves class to the stroke. */
    for (const theme of THEMES) {
      const c = parse(spotLineExpressions(theme).color, 'line', 'line-color');
      const same = (a: unknown, b: string) => expect(hex(a)).toBe(hex(parse(b as never, 'line', 'line-color')({})));
      same(c({ spot_type: 'hot', lst_rel: -4 }), token(theme, HOT_STROKE));
      same(c({ spot_type: 'cold', lst_rel: 4 }), token(theme, COLD_STROKE));
      // Independent of magnitude: a hot-classified spot keeps the warm stroke at every value.
      expect(hex(c({ spot_type: 'hot', lst_rel: -6 }))).toBe(hex(c({ spot_type: 'hot', lst_rel: 6 })));
    }
  });

  test('the stroke pair is the only ramp pair clearing 3:1 in BOTH grounds (§5.7)', () => {
    // Every darker member fails in Nocturne and every lighter one fails in Modernist, so this
    // is a measured choice rather than a taste one: changing it breaks one theme silently.
    expect([HOT_STROKE, COLD_STROKE]).toEqual(['--hot-4', '--cold-3']);
  });

  test('outline is dashed AND 0.4 thicker when bh_significant is false (ruling 11)', () => {
    const { width, dasharray } = spotLineExpressions('nocturne');
    const w = parse(width, 'line', 'line-width');
    expect(w({ bh_significant: true }, 6)).toBeCloseTo(2.2, 10);
    expect(w({ bh_significant: false }, 6)).toBeCloseTo(2.6, 10);
    expect(w({ bh_significant: true }, 12)).toBeCloseTo(1.1, 10);
    expect(w({ bh_significant: false }, 12)).toBeCloseTo(1.5, 10);
    // A missing flag is treated as not significant, which is the honest default for a claim
    // about statistical significance.
    expect(w({}, 6)).toBeCloseTo(2.6, 10);
    expect([...dasharray]).toEqual([3, 3]);
  });

  test('outline width steps 2.2 / 1.6 / 1.1 at zoom 8 and 11', () => {
    // `step` boundaries are inclusive-below, which is what makes this equal the original's
    // `z<8 ? 2.2 : z<11 ? 1.6 : 1.1` - including at exactly 8 and exactly 11.
    const w = parse(spotLineExpressions('modernist').width, 'line', 'line-width');
    const at = (z: number) => w({ bh_significant: true }, z);
    expect(at(5)).toBeCloseTo(2.2, 10);
    expect(at(7.99)).toBeCloseTo(2.2, 10);
    expect(at(8)).toBeCloseTo(1.6, 10);
    expect(at(10.99)).toBeCloseTo(1.6, 10);
    expect(at(11)).toBeCloseTo(1.1, 10);
    expect(at(16)).toBeCloseTo(1.1, 10);
  });

  test('the zoom curve must be TOP-LEVEL: the obvious `+` form is a parse error, not a style', () => {
    /* Ruling 11 reads as "the zoom weight PLUS 0.4", and writing it that way is rejected:
     * `['zoom']` may only be the direct input of a top-level step or interpolate. A rejected
     * paint expression means the layer draws no outline at all - a whole encoding channel gone,
     * in the browser, with nothing failing here. This test is why `spotLineExpressions` puts
     * the `case` inside each `step` branch instead. */
    const spec = (latest as unknown as Record<string, Record<string, unknown>>).paint_line['line-width'];
    const naive = createPropertyExpression(
      ['+', ['step', ['zoom'], 2.2, 8, 1.6, 11, 1.1], ['case', ['==', ['get', 'bh_significant'], true], 0, 0.4]] as never,
      'line-width',
      spec as never,
    );
    expect(naive.result).toBe('error');
    // And the shipped form is accepted.
    const real = createPropertyExpression(spotLineExpressions('nocturne').width as never, 'line-width', spec as never);
    expect(real.result).toBe('success');
  });

  test('dasharray is a constant by CHOICE: data-driven parses, but solid would be the [1,0] hack', () => {
    /* The assumption to resist is "line-dasharray cannot be data-driven". It can: the property
     * is cross-faded-data-driven in this MapLibre and the expression below parses. What it has
     * no value for is "no dash" - solid must be spelled `[1, 0]`, a generated dash texture with
     * a zero-length gap - and the significant spots are the majority and the ones a reader is
     * meant to trust, so they are the worst case to put a texture hack on. Hence two line
     * layers over one source. If a later MapLibre gains a real no-dash value, the layers can be
     * merged and this test is where to find out. */
    const spec = (latest as unknown as Record<string, Record<string, unknown>>).paint_line['line-dasharray'];
    const r = createPropertyExpression(
      ['case', ['==', ['get', 'bh_significant'], true], ['literal', [1, 0]], ['literal', [3, 3]]] as never,
      'line-dasharray',
      spec as never,
    );
    expect(r.result).toBe('success');
    expect((spec as Record<string, unknown>)['property-type']).toBe('cross-faded-data-driven');
    expect([...spotLineExpressions('nocturne').dasharray]).toEqual([3, 3]);
  });
});

describe('the filters - the original`s activeSpots predicate', () => {
  const keep = (expr: Expr, props: Props) => {
    const f = parse(expr, 'fill', 'fill-opacity');
    // Reused as a numeric expression so the same parser can evaluate a boolean-valued filter.
    return f(props);
  };
  const p = (over: Props = {}) => ({ period: 'day', contour_level: 'L50', cluster25: 7, city: 'Kano', ...over });

  test('the default state filters on period only, so all 441 are drawn nested', () => {
    const e = spotFilter('day', 'all', 'all', null);
    expect(keep(['case', e, 1, 0] as Expr, p())).toBe(1);
    expect(keep(['case', e, 1, 0] as Expr, p({ period: 'night' }))).toBe(0);
  });

  test('cluster25 is compared as a STRING, because it is a number in the geojson', () => {
    // The original bridged that with String(p.cluster25) at every comparison (line 683). An
    // `['==', ['get','cluster25'], '7']` would be false for every feature and the control would
    // silently empty the map.
    const e = ['case', spotFilter('day', 'all', '7', null), 1, 0] as Expr;
    expect(keep(e, p())).toBe(1);
    expect(keep(e, p({ cluster25: 8 }))).toBe(0);
  });

  test('contour and city narrow further, and all four clauses are ANDed', () => {
    const e = ['case', spotFilter('night', 'L90', '7', 'Kano'), 1, 0] as Expr;
    expect(keep(e, p({ period: 'night', contour_level: 'L90' }))).toBe(1);
    expect(keep(e, p({ period: 'night', contour_level: 'L50' }))).toBe(0);
    expect(keep(e, p({ period: 'night', contour_level: 'L90', city: 'Lagos' }))).toBe(0);
  });
});

test('THEME_TOKENS carries every token the map paints with, in both themes', () => {
  // The map resolves token NAMES through THEME_TOKENS rather than getComputedStyle, so a token
  // that lives only in the CSS would throw at style-build time - in the browser, on a theme
  // change, with no test having noticed.
  for (const theme of THEMES) {
    for (const name of [...RAMP_TOKENS, HOT_STROKE, COLD_STROKE, '--ui-muted', '--ui-line', '--ui-line-strong', '--ui-panel', '--ui-panel-2', '--color-bg', '--color-surface']) {
      expect(THEME_TOKENS[theme][name], `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  }
});
