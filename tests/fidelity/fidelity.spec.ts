/* The fidelity guard (spec §3): the rebuild against project/nigeria-suhi-dashboard.html.
 *
 * ONE test per theme, not one per assertion. Each loads both pages once and then checks tokens,
 * geometry, typography and the PENDING list against the captured data, using soft assertions so
 * a run reports every category of difference at once instead of stopping at the first. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ALLOWED_DIFFS, CONTENT_PENDING, PENDING, contentPendingSelectors, pendingSelectors } from './allowed-diffs';
import { ORIGINAL, REBUILD, openPage, type Theme } from './pages';
import { BOX_PROPS, TYPE_PROPS, capture } from './measure';

const ROOT = resolve(import.meta.dirname, '..', '..');
const TOLERANCE = 0.5;

/** Every selector app.css gives a box or type to (spec §7.1 plus the rules themselves). */
const SELECTORS: readonly string[] = [
  '.app', '.top', '.brand', '.brand b', '.brand span', '.tabs', '.tab', '.top .sp', '.ghost',
  '.pickers', '.mini-sel',
  '.body', '.rail', '.sec-h', '.search', '.rowlist', '.rw', '.kpis', '.kpi', '.kpi .lab',
  '.kpi .val', '.kpi .sub', '.bar', '.layers', '.ly', '.sw', '.ly .chip', '.ly .key',
  '.seg', '.seg button', 'input[type=range]', '.ramp', '.rampL', '.note', '.i18nnote',
  '.stage', '.mapwrap', '#map', '.swipetag', '.swipe', '.swipe .grab',
  '.ovl', '.mapttl', '.mapsub', '.zbtn', '.citylabel',
  '.tip', '.drawer', '.pill', '.rule', '.dl2', '.dl2 dt', '.dl2 dd',
  '.panel', '.panel h2', '.lede',
  'table.dt', 'table.dt th', 'table.dt td',
  '.cmp', '.card2', '.cbar', '.cbar .t', '.cbar .track', '.cbar .v',
  '.picker', '.pk', '.brief', '.brief h3', '.expgrid',
];

/** Token names read from the original's own three sources. Enumerating getComputedStyle does
 * not list custom properties, so a test built that way compares zero tokens and always passes. */
function declaredTokenNames(): string[] {
  const files = [
    'project/nigeria-suhi-dashboard.html',
    'project/_ds/nocturne-4e7aa328-2ddc-4aa9-8123-bb8ee4d346b1/styles.css',
    'project/_ds/modernist-d5e8375d-9e34-4bca-b8f9-2fafa7569ce0/styles.css',
  ];
  const names = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(resolve(ROOT, f), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/gi)) names.add(m[1]);
  }
  return [...names].sort();
}

/* Vite's CSS parser re-serialises declarations, so the rebuild reports
 * `"Inter", system-ui, sans-serif` where the original reports `"Inter",system-ui,sans-serif`,
 * and `rgba(16, 17, 25, .78)` for `rgba(16,17,25,.78)`. Those are the same value. Comparing the
 * raw strings produced six "differences" that were entirely whitespace, which is the kind of
 * noise that teaches people to ignore a guard. */
const normaliseTokenValue = (v: string): string => v.replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();

const addedTokens = new Set(
  ALLOWED_DIFFS.filter((d) => d.property === 'token-added').flatMap((d) => d.target.split(',')),
);
const boxExempt = new Set(ALLOWED_DIFFS.filter((d) => d.property === 'box').map((d) => d.target));

for (const theme of ['nocturne', 'modernist'] as Theme[]) {
  test(`[${theme}] the rebuild matches the original`, async ({ browser }) => {
    const names = declaredTokenNames();
    expect(names.length, 'token extraction returned too few names to be real').toBeGreaterThan(40);

    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await openPage(a, ORIGINAL, theme);
    await openPage(b, REBUILD, theme);
    const [orig, built] = await Promise.all([
      capture(a, names, SELECTORS),
      // The rebuild is also asked for the tokens it ADDS. `names` comes from the original's
      // files, where no -ink token exists, so querying only `names` made every ink token look
      // missing while it was resolving perfectly in the browser.
      capture(b, [...names, ...addedTokens], [...SELECTORS, ...PENDING.map((p) => p.selector)]),
    ]);
    await ctx.close();

    // 1. Tokens that exist in the original must resolve identically.
    const tokenDiffs = names
      .filter((n) => !addedTokens.has(n) && normaliseTokenValue(orig.tokens[n]) !== normaliseTokenValue(built.tokens[n]))
      .map((n) => `${n}: original ${JSON.stringify(orig.tokens[n])} vs rebuild ${JSON.stringify(built.tokens[n])}`);
    expect.soft(tokenDiffs, `${tokenDiffs.length} token(s) differ`).toEqual([]);

    // 2. The tokens the rebuild ADDS must actually be there. Without this, a dropped @import
    //    reads as "no differences" because every ink token is exempt from check 1.
    const missingInk = [...addedTokens].filter((n) => !built.tokens[n]);
    expect.soft(missingInk, 'ink/accent tokens missing from the rebuild').toEqual([]);

    // 3. Geometry and typography, for selectors both pages have.
    const compared: string[] = [];
    const boxDiffs: string[] = [];
    for (const sel of SELECTORS) {
      if (pendingSelectors.has(sel)) continue;
      const o = orig.boxes[sel];
      const r = built.boxes[sel];
      if (!o.present) continue; // absent in the original too: nothing to hold the rebuild to
      if (!r.present) {
        boxDiffs.push(`${sel}: in the original, missing from the rebuild, and not in PENDING`);
        continue;
      }
      /* Present but not yet sized by its content (CONTENT_PENDING): presence is required, the
       * measurements are not comparable until the owning task lands. */
      if (contentPendingSelectors.has(sel)) continue;
      compared.push(sel);
      for (const p of TYPE_PROPS) {
        if (o.style[p] !== r.style[p]) boxDiffs.push(`${sel} ${p}: ${o.style[p]} vs ${r.style[p]}`);
      }
      if (boxExempt.has(sel)) continue;
      for (const p of BOX_PROPS) {
        if (o.style[p] !== r.style[p]) boxDiffs.push(`${sel} ${p}: ${o.style[p]} vs ${r.style[p]}`);
      }
      if (Math.abs(o.width - r.width) > TOLERANCE) boxDiffs.push(`${sel} width: ${o.width} vs ${r.width}`);
      if (Math.abs(o.height - r.height) > TOLERANCE) boxDiffs.push(`${sel} height: ${o.height} vs ${r.height}`);
    }
    // Guard the guard: if the selector list or the capture broke, `compared` collapses and
    // every comparison above passes having checked nothing.
    expect.soft(compared.length, `only ${compared.length} selector(s) were actually compared`).toBeGreaterThan(8);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s)`).toEqual([]);

    // 4. The anti-rot clause (ruling 2): a PENDING selector that now exists has become a silent
    //    permanent exemption, which is the failure mode this whole file exists to prevent.
    const stale = PENDING.filter((p) => built.boxes[p.selector]?.present).map(
      (p) => `${p.selector} now exists (task ${p.task} owns it) - delete its PENDING line so the guard compares it`,
    );
    expect.soft(stale, 'PENDING has gone stale').toEqual([]);

    // 5. CONTENT_PENDING entries must at least EXIST - the category exempts their measurements,
    //    not their presence, or it would become a way to skip a selector entirely.
    const missingContent = CONTENT_PENDING.filter((c) => !built.boxes[c.selector]?.present).map(
      (c) => `${c.selector} is CONTENT_PENDING (task ${c.task}) but absent from the rebuild entirely`,
    );
    expect.soft(missingContent, 'CONTENT_PENDING entries must be present').toEqual([]);
  });
}

test('every CONTENT_PENDING entry names the task that resolves it and why', () => {
  // Task 12 asserts this list is empty. Until then, each entry has to justify itself.
  for (const c of CONTENT_PENDING) {
    expect(c.task, `${c.selector} must name an owning task`).toBeGreaterThan(2);
    expect(c.why.length, `${c.selector} must explain why it cannot be compared`).toBeGreaterThan(40);
  }
});

test('every ALLOWED_DIFFS entry cites a spec section', () => {
  /* Ruling 15. The citation is what stops the exemption list becoming a way to silence the
   * guard, and a test is the only thing that keeps that rule true. */
  expect(ALLOWED_DIFFS.filter((d) => !/^spec §/.test(d.cite)).map((d) => d.target)).toEqual([]);
  expect(ALLOWED_DIFFS.length).toBeGreaterThan(8);
});
