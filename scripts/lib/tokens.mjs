/**
 * Single home for every design-token value that is not a data ramp.
 * `scripts/palette.mjs` and `src/styles/suhi-tokens.css` render these; Task 4's contrast
 * audit imports them. Change a value here first, then in the CSS (a test checks they agree).
 */
import { deepFreeze } from './freeze.mjs';

export const THEME_TOKENS = deepFreeze({
  nocturne: {
    '--bg': '#12151a',
    '--surface': '#1a1e25',
    '--surface-2': '#242931',
    '--rule-color': '#2e343d',
    '--rule-strong-color': '#434a55',
    '--text': '#eef1f5',
    '--text-muted': '#9aa3b0',
    '--accent': '#35c07d',
    '--on-accent': '#0a0d11',
    '--hot-ink': '#f2b64e',
    '--cold-ink': '#98c9eb',
    '--neutral-mid': '#39404b',
    '--track': '#b6bdc9',
  },
  modernist: {
    '--bg': '#ffffff',
    '--surface': '#f4f5f6',
    '--surface-2': '#e9ebed',
    '--rule-color': '#d5d9dd',
    '--rule-strong-color': '#1a1d22',
    '--text': '#14171c',
    '--text-muted': '#5b6472',
    '--accent': '#0e7a4a',
    '--on-accent': '#ffffff',
    '--hot-ink': '#ac4a11',
    '--cold-ink': '#3563a4',
    '--neutral-mid': '#d9dcdf',
    '--track': '#c2c8cf',
  },
});

/** Theme-independent values (spec §4.1-4.3, §5.4). Font shorthands exclude the family. */
export const SCALE_TOKENS = deepFreeze({
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--space-12': '48px',
  '--radius-sm': '0px',
  '--radius-md': '2px',
  '--radius-lg': '4px',
  '--rule': '1px',
  '--rule-strong': '2px',
  '--hit': '44px',
  '--bar-cap': '2px',
  '--font-family': 'Archivo, system-ui, sans-serif',
  '--font-display': '800 34px/1.1',
  '--font-figure': '800 40px/1.1',
  '--font-title': '700 22px/1.2',
  '--font-section': '700 13px/1.3',
  '--font-body': '400 14px/1.6',
  '--font-label': '600 12px/1.3',
  '--tracking-display': '-0.03em',
  '--tracking-figure': '-0.03em',
  '--tracking-title': '-0.015em',
  '--tracking-section': '0.07em',
  '--tracking-label': '0.07em',
});

/** Spacing multipliers keyed by `html[data-density]`. */
export const DENSITY = deepFreeze({ compact: 0.85, default: 1, touch: 1.15 });
