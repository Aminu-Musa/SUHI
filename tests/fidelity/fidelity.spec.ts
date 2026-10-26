/* The fidelity guard (spec §3): the rebuild against project/nigeria-suhi-dashboard.html.
 *
 * ONE test per theme, not one per assertion. Each loads both pages once and then checks tokens,
 * geometry, typography and the PENDING list against the captured data, using soft assertions so
 * a run reports every category of difference at once instead of stopping at the first. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_DIFFS, CONTENT_PENDING, PENDING, contentPendingSelectors, pendingSelectors } from './allowed-diffs';
import { ORIGINAL, REBUILD, openPage, type Theme } from './pages';
import { BOX_PROPS, TYPE_PROPS, capture, type Capture } from './measure';

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
  '.tip', '.drawer',
  '.panel', '.panel h2', '.lede',
  'table.dt', 'table.dt th', 'table.dt td',
  '.cmp', '.card2', '.cbar', '.cbar .t', '.cbar .track', '.cbar .v',
  '.picker', '.pk', '.brief', '.brief h3', '.expgrid',
];

/* THE DRAWER'S OWN SELECTORS, measured in a SECOND pass with a city open on both pages.
 *
 * They cannot go in SELECTORS above: on a freshly loaded page the drawer is an empty aside on
 * both the original and the rebuild, so every one of these is absent from both and the main
 * loop skips them - which is the shape of a selector that is never actually checked.
 *
 * EVERY ONE IS SCOPED TO `.drawer`, and that is Task 5's finding doing real work: the guard
 * reads `document.querySelector(sel)`, the FIRST match, and `.dl2`, `.kpis`, `.kpi`, `.bar`,
 * `.rowlist` and `.rw` all exist in the rail as well. A bare `.dl2` would have measured the
 * rail's cluster card and reported the drawer correct.
 *
 * `.drawer .bar i` is box-exempt (ALLOWED_DIFFS, spec 9.1 bug 4: the population bar's width
 * changed from `pop_hot/230` to a share of the national maximum). Its TYPE is still compared,
 * and the track it sits in - `.drawer .bar` - is not exempt at all, so the fix cannot quietly
 * resize anything else. */
const DRAWER_SELECTORS: readonly string[] = [
  '.drawer .pill', '.drawer .rule',
  '.drawer .dl2', '.drawer .dl2 dt', '.drawer .dl2 dd',
  '.drawer .kpis', '.drawer .kpi', '.drawer .kpi .lab', '.drawer .kpi .val', '.drawer .kpi .sub',
  '.drawer .bar', '.drawer .bar i',
  '.drawer .rowlist', '.drawer .rw', '.drawer .sec-h', '.drawer .note',
];

/** Opens the CITY drawer on each page, on the first city in cities.json so both land on the
 * same record.
 *
 * The two routes differ and that is deliberate: the guard compares the resulting STATE, not the
 * road to it. The original's `openCity` is a global function in a classic script, which is the
 * most direct handle it has; the rebuild has no globals in a production build, so it is driven
 * the way a reader drives it - a click on the first city ring, which `focusCity` turns into
 * scope, camera and drawer. `dispatchEvent` rather than `click()` because the rings are nested
 * (largest first, so the smaller one paints on top) and Playwright would refuse the covered
 * one. */
async function openCityDrawer(page: Page, which: 'original' | 'rebuild'): Promise<void> {
  if (which === 'original') {
    await page.waitForFunction(
      () => typeof (globalThis as Record<string, unknown>).openCity === 'function',
      undefined,
      { timeout: 30_000, polling: 100 },
    );
    /* A STRING rather than a function, and that is the whole difficulty of driving the
     * original. `openCity` is a function declaration, so it IS a property of `globalThis`, but
     * `CITIES` is a top-level `let` (prototype line 575) - and `let` at the top level of a
     * classic script creates a binding in the global LEXICAL environment, not a property on
     * `globalThis`. `globalThis.CITIES` is therefore `undefined`, which is how the first run of
     * this pass failed. A string expression is evaluated in the page's own scope, where the
     * lexical binding is in scope like any other identifier. */
    await page.evaluate('openCity(CITIES[0].city)');
  } else {
    await page.waitForSelector('.citycircle', { timeout: 30_000 });
    await page.locator('.citycircle').first().dispatchEvent('click');
  }
  await page.waitForFunction(
    () => document.getElementById('drawer')?.dataset.open === 'true',
    undefined,
    { timeout: 30_000, polling: 100 },
  );
  /* The drawer slides in over .22s. These measurements are of its CONTENT rather than of the
   * transform, but a mid-transition read of a transformed box is not worth the ambiguity. */
  await page.waitForTimeout(400);
}

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
    /* The context stays OPEN until after pass 3b: the drawer is measured on the same two pages
     * rather than on two fresh loads, which is what keeps the suite at four page loads. */

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
    compare(SELECTORS, orig, built, compared, boxDiffs);
    // Guard the guard: if the selector list or the capture broke, `compared` collapses and
    // every comparison above passes having checked nothing.
    expect.soft(compared.length, `only ${compared.length} selector(s) were actually compared`).toBeGreaterThan(8);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s)`).toEqual([]);

    /* 3b. THE DRAWER, open on the same city on both pages. A second capture rather than a
     *     second test: a page load of the original costs ~25 s, so the suite's whole shape is
     *     "load four pages, assert many times". */
    await Promise.all([openCityDrawer(a, 'original'), openCityDrawer(b, 'rebuild')]);
    const [origDrawer, builtDrawer] = await Promise.all([
      capture(a, [], DRAWER_SELECTORS),
      capture(b, [], DRAWER_SELECTORS),
    ]);
    const drawerCompared: string[] = [];
    compare(DRAWER_SELECTORS, origDrawer, builtDrawer, drawerCompared, boxDiffs);
    expect
      .soft(drawerCompared.length, `only ${drawerCompared.length} drawer selector(s) were compared`)
      .toBeGreaterThan(10);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s) including the drawer`).toEqual([]);
    await ctx.close();

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

/** One selector list, two captures. Appends to `compared` and `diffs` rather than asserting, so
 * a run reports every category of difference at once instead of stopping at the first. */
function compare(
  selectors: readonly string[],
  orig: Capture,
  built: Capture,
  compared: string[],
  diffs: string[],
): void {
  for (const sel of selectors) {
    if (pendingSelectors.has(sel)) continue;
    const o = orig.boxes[sel];
    const r = built.boxes[sel];
    if (!o.present) continue; // absent in the original too: nothing to hold the rebuild to
    if (!r.present) {
      diffs.push(`${sel}: in the original, missing from the rebuild, and not in PENDING`);
      continue;
    }
    /* Present but not yet sized by its content (CONTENT_PENDING): presence is required, the
     * measurements are not comparable until the owning task lands. */
    if (contentPendingSelectors.has(sel)) continue;
    compared.push(sel);
    for (const p of TYPE_PROPS) {
      if (o.style[p] !== r.style[p]) diffs.push(`${sel} ${p}: ${o.style[p]} vs ${r.style[p]}`);
    }
    if (boxExempt.has(sel)) continue;
    for (const p of BOX_PROPS) {
      if (o.style[p] !== r.style[p]) diffs.push(`${sel} ${p}: ${o.style[p]} vs ${r.style[p]}`);
    }
    if (Math.abs(o.width - r.width) > TOLERANCE) diffs.push(`${sel} width: ${o.width} vs ${r.width}`);
    if (Math.abs(o.height - r.height) > TOLERANCE) diffs.push(`${sel} height: ${o.height} vs ${r.height}`);
  }
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
