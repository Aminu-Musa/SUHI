/* Spec §8.5's stylesheet. Node environment: nothing here needs a document, because jsdom
 * CANNOT HELP with this file. It does not evaluate media queries at all, so
 * `getComputedStyle` inside jsdom returns the SCREEN value for every property in print.css —
 * a test written that way would assert the opposite of what it reads and pass. The only honest
 * assertion against an `@media print` block in this harness is on the stylesheet's own TEXT.
 *
 * THIS SUITE MUST FIRST PROVE IT READ SOMETHING. Vite's `?raw` returns an EMPTY STRING unless
 * `test.css` is on, and a text assertion against '' passes every `not.toContain` and fails
 * nothing. Task 7 measured 0 characters before `css: true` went into vite.config.ts and 18,087
 * after; the first test below is the tripwire for that setting being removed, and every other
 * test in the file depends on it.
 */

import { expect, test } from 'vitest';
import rawPrint from './print.css?raw';
import rawTokens from './suhi-tokens.css?raw';
import rawInk from './ink.css?raw';
import rawCss from './app.css?raw';
import rawIndex from '../../index.html?raw';
import { TEXT_FLOOR, TEXT_GROUNDS } from '../../scripts/lib/ink.mjs';
import { contrastRatio } from '../../scripts/lib/color.mjs';

/** Strips CSS comments, so a rule quoted in a comment can never satisfy an assertion about the
 * rules. Every structural test below runs against this, not against the raw text. */
const CODE = rawPrint.replace(/\/\*[\s\S]*?\*\//g, '');

/** `html[data-theme="modernist"] { … }` out of one file, as a property -> value map. These
 * blocks are flat declaration lists with no nested braces, so the first `}` ends them. */
function modernistBlock(css: string): Record<string, string> {
  const at = css.indexOf('html[data-theme="modernist"]');
  expect(at, 'the modernist block must exist to compare against').toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return declarations(body);
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const clean = line.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!clean.startsWith('--')) continue;
    const colon = clean.indexOf(':');
    out[clean.slice(0, colon).trim()] = clean.slice(colon + 1).replace(/;$/, '').trim();
  }
  return out;
}

/** The token block inside `@media print`, by the selector it is written with. */
function printTokens(): Record<string, string> {
  const at = CODE.indexOf('html[data-theme] {');
  expect(at, 'the print token block must be written on html[data-theme] - see the specificity note').toBeGreaterThan(-1);
  return declarations(CODE.slice(CODE.indexOf('{', at) + 1, CODE.indexOf('}', at)));
}

test('the stylesheet was actually READ, so every assertion below is about something', () => {
  /* Vite `?raw` with `test.css` off returns ''. Measured on this file at the time of writing:
   * 10,077 characters. The floor is deliberately well under that and well over zero. */
  expect(rawPrint.length, `print.css read back ${rawPrint.length} characters`).toBeGreaterThan(2_000);
  expect(rawTokens.length).toBeGreaterThan(2_000);
  expect(rawInk.length).toBeGreaterThan(500);
  expect(rawPrint).toContain('@media print');
});

test('every rule lives inside the one @media print block, so no pixel on screen can move', () => {
  /* The §8.5 claim that this file needs no ALLOWED_DIFFS entry and leaves the fidelity guard at
   * 6/6 rests entirely on this: a rule that escaped the block would be a screen rule, and the
   * guard would be comparing the rebuild against the original with one extra stylesheet. */
  const body = CODE.trim();
  expect(body.startsWith('@media print {')).toBe(true);
  expect(body.endsWith('}')).toBe(true);
  // Brace depth returns to zero exactly once, at the very end - i.e. there is ONE top-level block.
  let depth = 0;
  let closesAt = -1;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '{') depth += 1;
    else if (body[i] === '}') {
      depth -= 1;
      if (depth === 0 && closesAt === -1) closesAt = i;
    }
  }
  expect(depth).toBe(0);
  expect(closesAt, 'the @media print block must be the only top-level rule').toBe(body.length - 1);
});

/* ── ruling 48 ─────────────────────────────────────────────────────────────────────────────── */

test('RULING 48: the print block carries the Modernist token set, declaration for declaration', () => {
  /* The 66 declarations are COPIED from two generated-or-authored sources that own them. This
   * test is the only thing standing between print.css and a stale copy: change a Modernist
   * token or re-run `npm run ink`, and this fails until print.css follows. */
  const source = { ...modernistBlock(rawTokens), ...modernistBlock(rawInk) };
  expect(Object.keys(source)).toHaveLength(66);
  expect(printTokens()).toEqual(source);
});

test('RULING 48: print carries no Nocturne value anywhere, because paper is a light ground', () => {
  const printed = Object.values(printTokens());
  // Nocturne's three grounds and its text colour. None may appear in a printed page.
  for (const hex of ['#161826', '#232532', '#e9e9ed', '#1d1f2e']) {
    expect(printed, `${hex} is a Nocturne value and must not reach paper`).not.toContain(hex);
  }
});

test('RULING 48: Modernist ink on PURE WHITE is already audited, which is the whole argument', () => {
  /* The claim print.css rests on, asserted rather than cited: Modernist's `--ui-tip` is
   * `#ffffff`, `--ui-tip` is one of the three grounds `scripts/lib/ink.mjs` derives every
   * `-ink` value against, and so every Modernist ink value already clears 4.5:1 on white. If
   * that stops being true, forcing these tokens under @media print stops being justified. */
  const tokens = printTokens();
  expect(tokens['--ui-tip']).toBe('#ffffff');
  expect(TEXT_GROUNDS).toEqual(['--color-bg', '--ui-panel-2', '--ui-tip']);
  const inks = Object.entries(tokens).filter(([k]) => k.endsWith('-ink'));
  expect(inks).toHaveLength(11);
  for (const [name, hex] of inks) {
    const ratio = contrastRatio(hex, '#ffffff');
    expect(ratio, `${name} (${hex}) on #ffffff is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
  }
  // And the body text, which is not an -ink token but is the most-printed colour on the page.
  expect(contrastRatio(tokens['--color-text'], '#ffffff')).toBeGreaterThanOrEqual(TEXT_FLOOR);
  expect(contrastRatio(tokens['--ui-muted'], '#ffffff')).toBeGreaterThanOrEqual(TEXT_FLOOR);
});

test('RULING 48: white is NOT a fourth TEXT_GROUND, and must not become one', () => {
  /* The alternative to forcing the Modernist tokens was adding white as a fourth ground in
   * `scripts/lib/ink.mjs`. That would re-derive all 22 ink values across both themes to buy a
   * proof the test above already has. Ruling 48 chose inheritance; this pins the choice. */
  expect(TEXT_GROUNDS).toHaveLength(3);
  expect(TEXT_GROUNDS).not.toContain('#ffffff');
  expect(TEXT_GROUNDS).not.toContain('--print-ground');
});

test('print.css is linked LAST, because it wins on cascade order rather than on specificity', () => {
  /* `html[data-theme]` is 0,1,1 - exactly `html[data-theme="nocturne"]`'s. Move this link above
   * suhi-tokens.css and a printed page comes out in Nocturne, with a lightened ink scale on
   * white that nothing has audited. */
  const links = [...rawIndex.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  expect(links).toEqual([
    '/src/styles/vendor/nocturne.css',
    '/src/styles/vendor/modernist.css',
    '/src/styles/suhi-tokens.css',
    '/src/styles/app.css',
    '/src/styles/print.css',
  ]);
});

/* ── what task 10's report asked for, item by item ─────────────────────────────────────────── */

/** Every rule inside `@media print`, as selector-list plus declaration body. The block has no
 * nesting beyond `@page`, which parses as a rule with the selector `@page` and is harmless. */
const RULES = [...CODE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean),
  body: m[2].trim(),
}));

/** The declaration body of the rule whose selector list contains `selector` EXACTLY. Exact
 * rather than substring: `.panel` must not be satisfied by a rule for `#panel-report`. */
function ruleFor(selector: string): string {
  const hit = RULES.filter((r) => r.selectors.includes(selector));
  expect(hit.length, `print.css has ${hit.length} rules whose selector list is exactly ${selector}`).toBe(1);
  return hit[0].body;
}

test('hides the chrome: .top, .rail, .stage, #tip and .drawer', () => {
  for (const selector of ['.top', '.rail', '.stage', '#tip', '.drawer']) {
    expect(ruleFor(selector)).toContain('display: none !important');
  }
});

test('forces #panel-report visible and block regardless of data-on, with every other panel hidden', () => {
  /* `.panel` is `display:none` and only `[data-on=true]` lifts it, so printing from any other
   * tab - which §8.4's `?tab=table` makes an entry point - would otherwise print a blank page. */
  expect(ruleFor('.panel')).toContain('display: none !important');
  const panel = ruleFor('#panel-report');
  expect(panel).toContain('display: block !important');
  expect(panel).toContain('overflow: visible');
});

test('releases .brief from its 640px, keeps it on one page, and gives it a REAL border', () => {
  /* The screen border is `box-shadow: inset 0 0 0 var(--ui-rule) var(--ui-line)`, and INSET BOX
   * SHADOWS DO NOT PRINT - print engines drop shadows, so the brief would come out as unbounded
   * text on white. The screen rule is asserted here too, so this test explains itself if
   * app.css ever changes how the brief is bounded. */
  expect(rawCss, 'the screen rule this one exists to override').toContain(
    'box-shadow:inset 0 0 0 var(--ui-rule) var(--ui-line)',
  );
  const brief = ruleFor('.brief');
  expect(brief).toContain('width: auto');
  expect(brief).toContain('max-width: none');
  expect(brief).toContain('box-shadow: none');
  expect(brief).toContain('break-inside: avoid');
  expect(brief).toMatch(/border: var\(--ui-rule\) solid var\(--ui-line\)/);
});

test('hides the export column: the grid, its heading and its filters note', () => {
  const rule = ruleFor('.expgrid');
  expect(rule).toContain('display: none !important');
  expect(CODE).toContain('.sec-h[data-i18n="data_export"]');
  expect(CODE).toContain('.note[data-i18n="export_note"]');
});

test('releases the page from the viewport-height flex column, or only the first page prints', () => {
  /* `body` is `overflow:hidden` and `.app` is `height:100vh`: a column clipped to one screen,
   * which on paper prints page one and silently drops the rest - which is also what would hide
   * 54 of ruling 49's 55 briefs. */
  const html = ruleFor('body');
  expect(html).toContain('height: auto');
  expect(html).toContain('overflow: visible');
  const app = ruleFor('.app');
  expect(app).toContain('display: block');
  expect(app).toContain('height: auto');
  expect(CODE).toContain('@page');
});

/* ── ruling 49 ─────────────────────────────────────────────────────────────────────────────── */

test('RULING 49: the 55-brief container is revealed by print and by nothing else', () => {
  /* `#printAll` carries an inline `display:none` in Reports.tsx, so this `!important` is the
   * only thing that ever shows it - and only on paper. Reports.test.tsx owns the other half:
   * that the container holds 55 briefs plus the national summary. */
  const rule = ruleFor('#printAll');
  expect(rule).toContain('display: block !important');
  expect(CODE).toContain('#printAll .brief');
  expect(CODE).toMatch(/break-after: page/);
  // The single-city brief steps aside while the full report prints, so the scoped city is not
  // printed twice. `:has()` keeps this out of the markup entirely.
  expect(CODE).toContain('#panel-report:has(#printAll) #brief');
});
