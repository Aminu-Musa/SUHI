/**
 * The two authored theme token blocks, as data (spec §4.1, §4.2), plus the two measured
 * corrections (§5.6 `--accent-fill`, §6.2 `--neutral-mid`).
 *
 * These are COPIED values, not designed ones: the original prototype
 * (`project/nigeria-suhi-dashboard.html`) is the authority. `src/styles/suhi-tokens.css`
 * declares the complete blocks; this module carries the hex-valued subset, because its
 * two consumers only ever need colours:
 *   - `scripts/audit-contrast.mjs` measures contrast between them,
 *   - `scripts/lib/ink.mjs` derives the ink scale from the ramps and the text grounds.
 *
 * TWO SEPARATE CONSTRAINTS apply to the values here, and they are not the same strength:
 *   - Every value must be SIX-DIGIT HEX, because the audit and the ink derivation parse
 *     each one with `parseHex` in `./color.mjs`, which accepts `#rrggbb` and nothing else.
 *     An `#rgb`, an `#rrggbbaa`, an `rgba()` or a `color-mix()` would throw there. This is
 *     why the two non-hex colour tokens of the authored blocks — `--color-divider`
 *     (`color-mix()`) and `--ui-scrim` (`rgba()`) — are deliberately NOT mirrored here. A
 *     later task that needs those resolved in JavaScript should add a separate non-hex map
 *     rather than loosen the invariant and break the audit's inputs.
 *   - No value may be a `var()`, because Task 6 resolves token *names* to colours through
 *     here to build MapLibre paint expressions and MapLibre would receive the literal
 *     string `"var(--color-neutral-800)"`. MapLibre itself would accept any concrete CSS
 *     colour string, so this constraint is weaker than the hex one above — it is the hex
 *     requirement, not MapLibre, that rules out `rgba()`.
 *
 * The non-colour values of the authored blocks (fonts, spacing, radii, shadows, `--ui-rule`)
 * live only in the CSS. `scripts/lib/tokens.test.mjs` fails if any value here drifts from
 * the CSS block it mirrors, if either side gains a token the other lacks, or if the two
 * themes stop carrying the same token names.
 */
import { deepFreeze } from './freeze.mjs';

export const THEME_TOKENS = deepFreeze({
  nocturne: {
    '--color-bg': '#161826',
    '--color-surface': '#232532',
    '--color-text': '#e9e9ed',
    '--color-accent': '#9184d9',
    '--color-neutral-100': '#f3f5fe',
    '--color-neutral-200': '#e4e7f5',
    '--color-neutral-300': '#cfd3e5',
    '--color-neutral-400': '#b2b6ca',
    '--color-neutral-500': '#9397ab',
    '--color-neutral-600': '#75798c',
    '--color-neutral-700': '#595d6c',
    '--color-neutral-800': '#3f424d',
    '--color-neutral-900': '#292b31',
    '--color-accent-200': '#e7e5fe',
    '--color-accent-300': '#d2cefd',
    '--color-accent-400': '#b5abfc',
    '--color-accent-500': '#968ae0',
    '--color-accent-600': '#796cbf',
    '--ui-panel': '#1c1e2b',
    '--ui-panel-2': '#292b31',
    '--ui-line': '#3f424d',
    '--ui-line-strong': '#595d6c',
    '--ui-muted': '#9397ab',
    '--ui-tip': '#1b1e2b',
    '--hot-1': '#f6e08a',
    '--hot-2': '#f2c14e',
    '--hot-3': '#ec9a3c',
    '--hot-4': '#e06b2f',
    '--hot-5': '#c9382c',
    '--cold-1': '#cfe4f7',
    '--cold-2': '#8fbfe8',
    '--cold-3': '#5793d1',
    '--cold-4': '#3467ad',
    '--cold-5': '#20407c',
    '--spot-stroke': '#e9e9ed',
    // §5.6: white-on-accent only. Everywhere else keeps --color-accent.
    '--accent-fill': '#796bbe',
    // §6.2: the diverging ramp's midpoint. Equals --color-neutral-800; see the CSS comment
    // and the test named for why it is duplicated as a literal rather than a var().
    '--neutral-mid': '#3f424d',
  },
  modernist: {
    '--color-bg': '#f3f2f2',
    '--color-surface': '#eae9e9',
    '--color-text': '#201e1d',
    '--color-accent': '#ec3013',
    '--color-neutral-100': '#f8f4f4',
    '--color-neutral-200': '#eae7e7',
    '--color-neutral-300': '#d7d3d3',
    '--color-neutral-400': '#bab6b6',
    '--color-neutral-500': '#9b9797',
    '--color-neutral-600': '#7d7979',
    '--color-neutral-700': '#605d5d',
    '--color-neutral-800': '#444141',
    '--color-neutral-900': '#2d2b2b',
    '--color-accent-200': '#ffe0d9',
    '--color-accent-300': '#ffc4b8',
    '--color-accent-400': '#ff9783',
    '--color-accent-500': '#ff563c',
    '--color-accent-600': '#dd2b0f',
    '--ui-panel': '#eae9e9',
    '--ui-panel-2': '#e2e0e0',
    '--ui-line': '#201e1d',
    '--ui-line-strong': '#201e1d',
    '--ui-muted': '#605d5d',
    '--ui-tip': '#ffffff',
    '--hot-1': '#e9b420',
    '--hot-2': '#e0902a',
    '--hot-3': '#d6691f',
    '--hot-4': '#c03c1a',
    '--hot-5': '#8e1408',
    '--cold-1': '#a8cfe8',
    '--cold-2': '#6ba6d8',
    '--cold-3': '#3d79bd',
    '--cold-4': '#23539b',
    '--cold-5': '#12306b',
    '--spot-stroke': '#201e1d',
    '--accent-fill': '#e52706',
    // Equals --color-neutral-400; literal for the same reason as Nocturne's.
    '--neutral-mid': '#bab6b6',
  },
});

/** The theme names, in declaration order. */
export const THEMES = Object.freeze(Object.keys(THEME_TOKENS));
