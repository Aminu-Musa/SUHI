/**
 * The ink scale (spec §5.1, §5.4).
 *
 * The ten ramp tokens and `--color-accent` are FILL colours and keep their authored
 * values. Each gets an `-ink` sibling for text use: the same hue and chroma, moved in
 * OKLCH lightness by the smallest amount that clears 4.5:1 on EVERY ground that
 * ramp-coloured text appears on. Nocturne lightens (`dir: +1`), Modernist darkens (-1).
 *
 * The search step is 0.002 in OKLCH L and is part of the contract: a different step
 * yields different hexes and will not reproduce the table in spec §5.4, which
 * `ink.test.mjs` pins. Do not "improve" the method here — the table is the authority.
 */
import { hexToOklch, oklchToHex, contrastRatio } from './color.mjs';
import { THEME_TOKENS } from './tokens.mjs';

/** Grounds that carry ramp-coloured text (spec §5.1). */
export const TEXT_GROUNDS = Object.freeze(['--color-bg', '--ui-panel-2', '--ui-tip']);

/** WCAG 2.1 AA body-text floor. `.kpi .val` is large text at 3.0 and is covered a fortiori. */
export const TEXT_FLOOR = 4.5;

/** Search step in OKLCH L. Part of the §5.4 contract. */
export const INK_STEP = 0.002;

/** Lightness direction per theme: lift on a dark ground, drop on a light one. */
export const INK_DIR = Object.freeze({ nocturne: 1, modernist: -1 });

/** Ink token -> the fill token it is derived from. */
export const INK_SOURCES = Object.freeze({
  '--hot-1-ink': '--hot-1',
  '--hot-2-ink': '--hot-2',
  '--hot-3-ink': '--hot-3',
  '--hot-4-ink': '--hot-4',
  '--hot-5-ink': '--hot-5',
  '--cold-1-ink': '--cold-1',
  '--cold-2-ink': '--cold-2',
  '--cold-3-ink': '--cold-3',
  '--cold-4-ink': '--cold-4',
  '--cold-5-ink': '--cold-5',
  // Accent TEXT derives from --color-accent. --accent-fill (§5.6) is the opposite
  // correction — the fill moving so white can sit on it — and is not a source here.
  '--accent-ink': '--color-accent',
});

/**
 * Smallest OKLCH lightness move from `hex`, in `dir`, that clears `floor` against every
 * ground. Hue and chroma are held exactly; only L moves.
 * Returns the emitted hex, the move in L (0 when the input already passes), and the
 * OKLCH triple that was accepted, before quantisation to 8-bit hex.
 */
export function deriveInk(hex, { grounds, dir, floor = TEXT_FLOOR } = {}) {
  if (!Array.isArray(grounds) || grounds.length === 0) throw new Error('deriveInk: grounds required');
  if (dir !== 1 && dir !== -1) throw new Error(`deriveInk: dir must be +1 or -1, got ${dir}`);

  const { L, C, H } = hexToOklch(hex);
  const clears = (candidate) => grounds.every((ground) => contrastRatio(candidate, ground) >= floor);

  for (let step = 0; ; step += 1) {
    const moved = step * INK_STEP;
    const Lp = L + dir * moved;
    if (Lp < 0 || Lp > 1) {
      throw new Error(`deriveInk: ${hex} cannot clear ${floor} on every ground within the L range`);
    }
    // At step 0 the round trip reproduces the authored hex, so an already-passing colour
    // is returned byte-identical and `moved` is 0.
    const candidate = step === 0 ? hexToPassThrough(hex, Lp, C, H) : oklchToHex(Lp, C, H);
    if (clears(candidate)) return { hex: candidate, moved, oklch: { L: Lp, C, H } };
  }
}

/**
 * At the zeroth step the derivation has not moved anything, so the authored hex IS the
 * answer; emitting the round trip instead would be a lossy no-op. Asserts the round trip
 * agrees, so a round-trip regression in color.mjs surfaces here rather than silently
 * shifting every "unchanged" token.
 */
function hexToPassThrough(hex, L, C, H) {
  const normalised = hex.toLowerCase();
  const roundTrip = oklchToHex(L, C, H);
  if (roundTrip !== normalised) {
    throw new Error(`deriveInk: hex round trip is lossy for ${hex} (got ${roundTrip})`);
  }
  return normalised;
}

/** All eleven ink values for a theme, in ramp order. */
export function INK_TOKENS(theme) {
  const tokens = THEME_TOKENS[theme];
  if (!tokens) throw new Error(`INK_TOKENS: unknown theme ${theme}`);
  const dir = INK_DIR[theme];
  const grounds = TEXT_GROUNDS.map((ground) => tokens[ground]);
  const out = {};
  for (const [name, source] of Object.entries(INK_SOURCES)) {
    out[name] = deriveInk(tokens[source], { grounds, dir, floor: TEXT_FLOOR }).hex;
  }
  return out;
}
