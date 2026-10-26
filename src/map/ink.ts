/* RULING 32 - the ramp read as TEXT, not as fill.
 *
 * The original interpolated a fill token and wrote it straight into `color:` four times over:
 * the drawer's `.pill` (prototype line 880), `spotTip`'s `<b>` (line 857), `cityTip`'s hot/cold
 * count spans (line 872) and `openSpot`'s `bh_significant` row (line 899). `.pill` is the worst
 * of them - 9.5px text whose `border: solid currentColor` takes the same colour, on
 * `--color-bg`, where Nocturne's `--cold-5` measures 1.75:1. A severe night cold spot's pill
 * was very nearly invisible.
 *
 * So this module is the fill scale's ink twin: the same two d3 scales, the same two domains,
 * over the `-ink` ramp instead of the fill ramp. Every ink token clears 4.5:1 on all three text
 * grounds in both themes by construction (spec §5.3), so a colour that comes out of here is
 * legible wherever it lands, and `currentColor` carries the fix into `.pill`'s border for free.
 *
 * WHY THE VALUES ARE DERIVED IN JS RATHER THAN READ FROM CSS. The original resolved tokens with
 * `cssv()` - `getComputedStyle(document.documentElement).getPropertyValue(name)` - because an
 * interpolated colour cannot be a `var()`: d3 has to mix two concrete colours. We still cannot
 * use `var()` for the interpolated cases, but we do not need the DOM either: `INK_TOKENS` is the
 * same derivation `npm run ink` writes into src/styles/ink.css, so asking it for a theme's
 * eleven values gives exactly the hexes the stylesheet declares. That keeps this testable as a
 * pure function (jsdom has no stylesheet, so `cssv` would return "" and every colour would be
 * black), and it keeps ONE derivation rather than a stylesheet and a copy.
 *
 * The derivation walks OKLCH lightness in 0.002 steps, so it is not free - hence the per-theme
 * memo. Two entries, computed at most once each per session.
 *
 * STATIC token usages do NOT come through here. `cityTip`'s spans are `--hot-4-ink` and
 * `--cold-4-ink` flat, the cluster line is `--accent-ink`, and those go in the DOM as
 * `var(--hot-4-ink)` so they re-resolve on a theme flip with no re-render at all. Only the
 * INTERPOLATED colour needs a resolved hex.
 */

import { scaleLinear } from 'd3';
import { INK_TOKENS } from '../../scripts/lib/ink.mjs';
import type { Theme } from '../app/ThemeProvider';
import type { SpotProperties } from '../app/data';
import { spotValue } from '../rail/stats';
import { token } from './expressions';

/** Prototype line 566-567, in ink. The fill ramp's `HOT`/`COLD` arrays, one suffix along. */
export const HOT_INK = ['--hot-1-ink', '--hot-2-ink', '--hot-3-ink', '--hot-4-ink', '--hot-5-ink'] as const;
export const COLD_INK = ['--cold-1-ink', '--cold-2-ink', '--cold-3-ink', '--cold-4-ink', '--cold-5-ink'] as const;

/** Prototype line 569: `hotScale` over [0, .9, 1.8, 2.7, 3.7], clamped. */
export const HOT_DOMAIN: readonly number[] = [0, 0.9, 1.8, 2.7, 3.7];
/** Prototype line 570: `coldScale` over [0, -.4, -.8, -1.2, -1.65], clamped. */
export const COLD_DOMAIN: readonly number[] = [0, -0.4, -0.8, -1.2, -1.65];

const memo = new Map<Theme, Record<string, string>>();

/** The eleven derived ink values for a theme, memoised. Same values as src/styles/ink.css. */
export function inkTokens(theme: Theme): Record<string, string> {
  let got = memo.get(theme);
  if (!got) {
    got = INK_TOKENS(theme) as Record<string, string>;
    memo.set(theme, got);
  }
  return got;
}

export function inkToken(theme: Theme, name: string): string {
  const value = inkTokens(theme)[name];
  if (!value) throw new Error(`unknown ink token ${name}`);
  return value;
}

/* `spotValue` - prototype line 702's year back-cast on `suhii` - is NOT redefined here. Task 4
 * put it in `src/rail/stats.ts` for the KPI tiles, it is the same arithmetic, and a second copy
 * is how the drawer and the rail come to disagree about the same spot. Re-exported so a reader
 * of this module can see which value the scales are being fed. */
export { spotValue };

/** `hotScale` / `coldScale`, in ink. Both clamp, which is what keeps a +6.65 °C spot on
 * `--hot-5-ink` instead of extrapolating off the end of the ramp. */
export function hotInkScale(theme: Theme): (v: number) => string {
  return scaleLinear()
    .domain(HOT_DOMAIN as number[])
    .range(HOT_INK.map((t) => inkToken(theme, t)))
    .clamp(true);
}

export function coldInkScale(theme: Theme): (v: number) => string {
  return scaleLinear()
    .domain(COLD_DOMAIN as number[])
    .range(COLD_INK.map((t) => inkToken(theme, t)))
    .clamp(true);
}

/**
 * Prototype lines 703-704 (`spotFill`), in ink.
 *
 * `Math.max(0, v)` / `Math.min(0, v)` is the original's, and it is not the same as clamping: a
 * hot-classified spot that measures COOLER than its city is pinned to the ramp's zero end
 * rather than being read on the cold ramp. Class picks the ramp; magnitude picks the stop. That
 * is §6.3's "class in the outline, never the fill" seen from the text side.
 */
export function spotInkFill(
  p: Pick<SpotProperties, 'suhii' | 'sen_slope_C_per_decade' | 'spot_type'>,
  year: number,
  theme: Theme,
): string {
  const v = spotValue(p as SpotProperties, year);
  return p.spot_type === 'hot' ? hotInkScale(theme)(Math.max(0, v)) : coldInkScale(theme)(Math.min(0, v));
}

/* ── the FILL scale, for the one place the drawer paints rather than writes ───────────────── */

/* `openCity`'s spot list draws an 8x8px swatch per row (prototype line 952):
 *   <span style="…;background:${spotFill(s)}"></span>
 * That is a FILL - a block of colour carrying no text - so ruling 32 leaves it on the fill
 * ramp. It is here, beside the ink twin, precisely so the difference is visible at a glance:
 * identical domains, identical structure, one token suffix apart, and the choice between them
 * is "is this read as text?" and nothing else.
 *
 * Nothing else in the drawer or the tooltip uses these. If a third caller appears, check it is
 * really a fill first. */
export const HOT_FILL = ['--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5'] as const;
export const COLD_FILL = ['--cold-1', '--cold-2', '--cold-3', '--cold-4', '--cold-5'] as const;

export function spotFillColor(
  p: Pick<SpotProperties, 'suhii' | 'sen_slope_C_per_decade' | 'spot_type'>,
  year: number,
  theme: Theme,
): string {
  const v = spotValue(p as SpotProperties, year);
  const ramp = p.spot_type === 'hot' ? HOT_FILL : COLD_FILL;
  const domain = p.spot_type === 'hot' ? HOT_DOMAIN : COLD_DOMAIN;
  const scale = scaleLinear()
    .domain(domain as number[])
    .range(ramp.map((t) => token(theme, t)))
    .clamp(true);
  return scale(p.spot_type === 'hot' ? Math.max(0, v) : Math.min(0, v));
}
