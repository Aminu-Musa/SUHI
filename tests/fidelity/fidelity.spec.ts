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

/* TASK 8's COMPARE SELECTORS, measured in a THIRD pass with the Compare tab active on both
 * pages.
 *
 * They are not in PENDING any more, so the main pass already compares their type and their box
 * properties - but `.panel` is `display:none` until its tab is selected, and a display:none box
 * measures 0x0. Comparing 0 against 0 is the shape of a selector that is never actually
 * checked, which is the trap Task 7 found with the drawer, so the geometry is taken here where
 * it exists.
 *
 * EVERY ONE IS SCOPED TO `#panel-compare`. `.card2` and `.cbar` both exist in the rail as well
 * (the cluster card and the top-typology bars), and the guard reads `document.querySelector`,
 * the FIRST match - so a bare `.card2` would measure the rail's card on a page where a cluster
 * had been picked and report Compare correct.
 *
 * `.cmp` and `#panel-compare .card2` are NOT in this list, and that is a measurement, not an
 * exemption: spec §7.5 doubles every `.cbar` row into two bars, so the card is taller than the
 * original's by exactly that second row, and the grid is taller by its tallest card. Their
 * TYPE and BOX properties are compared in the main pass and match; the two heights are reported
 * in the task 8 report for a ruling rather than registered in ALLOWED_DIFFS here. */
const COMPARE_SELECTORS: readonly string[] = [
  '#panel-compare .picker', '#panel-compare .pk',
  '#panel-compare .lede', '#panel-compare h2',
];

/* TASK 9's TABLE SELECTORS, measured in a FOURTH pass with the Data table tab active on both
 * pages.
 *
 * Exactly the trap pass 3c exists for, and worth spelling out because `table.dt` was in PENDING
 * until this task and a reader could reasonably assume deleting the PENDING line was the whole
 * job. `#panel-table` is `display:none` on the Map tab, which is the tab both pages load on. A
 * display:none element still resolves every computed property, so the main pass really does
 * compare all five TYPE_PROPS and all six BOX_PROPS for `table.dt`, `table.dt th` and
 * `table.dt td` - but `getBoundingClientRect()` is 0x0 on BOTH pages, so the width and height
 * comparisons are 0 vs 0 and prove nothing. The widths are the interesting measurement here:
 * seventeen columns with `white-space:nowrap` headings mean the browser solves the column
 * widths from the content, so a width match is evidence the content and the type match too.
 *
 * SCOPED TO `#panel-table` for the usual reason - `document.querySelector` returns the FIRST
 * match - although `table.dt` happens to be unique to this panel today. Scoping it costs
 * nothing and stops a later task's second `.dt` silently redirecting the measurement.
 *
 * `table.dt td` resolves to the FIRST cell of the FIRST row on both pages, so the default sort
 * has to agree: `sortKey='suhii', sortDir=-1` (prototype line 1112) puts the same city first,
 * and that cell is the city name - a 12px left-aligned string whose width is its text. If the
 * rebuild's default sort ever differed, this pass would report a td width difference. */
const TABLE_SELECTORS: readonly string[] = [
  '#panel-table table.dt', '#panel-table table.dt th', '#panel-table table.dt td',
  '#panel-table .lede', '#panel-table h2',
];

/** Switches both pages to a panel tab. The two routes differ for the same reason the drawer
 * pass's do: the guard compares the resulting STATE, not the road to it. Both pages carry a
 * `.tab[data-tab=…]` button, so here the road happens to be the same one a reader takes.
 *
 * The wait is on the panel's own `data-on`, which both pages set - `selectTab` writes it
 * directly (prototype line 1023) and the rebuild binds it to the Radix tab value. */
/* TASK 10's REPORT SELECTORS, measured in a FIFTH pass with the Reports tab active on both
 * pages — the same trap passes 3c and 3d exist for. `#panel-report` is `display:none` on the
 * Map tab, which is the tab both pages load on, so `.brief` and `.brief h3` resolve every
 * computed property for the main pass but measure 0x0 there and compare 0 against 0.
 *
 * `.brief` is the load-bearing one. Its WIDTH is a fixed 640px, so a width match proves little
 * on its own — but its HEIGHT is the sum of the whole brief: a header flex row, three `.rule`
 * dividers, a four-column 23px figure grid and a 12.5px/1.6 prose paragraph that wraps inside
 * 640px minus 38px of padding each side. Nothing about that height can match unless the type,
 * the figure grid and the prose text all match, which is why ruling 20's 23px is checked here
 * as well as in the component suite.
 *
 * `#panel-report .expgrid` is captured and REPORTED, not asserted — see the note above PENDING
 * in allowed-diffs.ts. Spec §7.7 replaces its six `.card2` cards with one select plus a button,
 * so its height cannot match, and the measurement belongs in the task report for a ruling
 * rather than in ALLOWED_DIFFS. It IS asserted to be present and non-zero on both pages, so it
 * can never quietly become an unmeasured selector.
 *
 * SCOPED TO `#panel-report` for the usual reason: the guard reads `document.querySelector`, the
 * FIRST match, and `.sec-h`, `.note` and `.rule` all exist in the rail and the drawer. */
const REPORT_SELECTORS: readonly string[] = [
  '#panel-report .brief', '#panel-report .brief h3',
  '#panel-report .lede', '#panel-report h2',
];

/** Present on both pages and measured, but exempt from the height comparison by §7.7. */
const REPORT_REPORTED: readonly string[] = ['#panel-report .expgrid'];

async function openPanelTab(page: Page, name: 'compare' | 'table' | 'report'): Promise<void> {
  await page.waitForSelector(`.tab[data-tab=${name}]`, { timeout: 30_000 });
  await page.locator(`.tab[data-tab=${name}]`).click();
  await page.waitForFunction(
    (n) => document.getElementById(`panel-${n}`)?.dataset.on === 'true',
    name,
    { timeout: 30_000, polling: 100 },
  );
  /* The panel goes from display:none to display:block and then lays out 55 wrapping buttons and
   * a four-column auto-fit grid - or, for the table, 55 rows of seventeen cells whose column
   * widths the browser solves from their content. A plain delay rather than rAF: the guard
   * holds two pages open in one context, so one is always backgrounded and its rAF is throttled
   * to nothing. */
  await page.waitForTimeout(400);
}

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

    /* 3c. TASK 8's COMPARE PANEL, with its tab active on both pages. AFTER 3b, not before: the
     *     drawer lives inside `.stage`, which `selectTab` hides off the Map tab (ruling 5), so
     *     measuring the drawer from the Compare tab would measure a 0x0 box. */
    await Promise.all([openPanelTab(a, 'compare'), openPanelTab(b, 'compare')]);
    const [origCmp, builtCmp] = await Promise.all([
      capture(a, [], COMPARE_SELECTORS),
      capture(b, [], COMPARE_SELECTORS),
    ]);
    const cmpCompared: string[] = [];
    compare(COMPARE_SELECTORS, origCmp, builtCmp, cmpCompared, boxDiffs);
    expect
      .soft(cmpCompared.length, `only ${cmpCompared.length} compare selector(s) were compared`)
      .toBe(COMPARE_SELECTORS.length);
    // The picker is the load-bearing one: 55 wrapping buttons, so a width or height difference
    // here means the flex wrap landed differently, which no 0x0 comparison could have seen.
    expect
      .soft(origCmp.boxes['#panel-compare .picker'].height, 'the picker must have real height on the Compare tab')
      .toBeGreaterThan(20);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s) including compare`).toEqual([]);

    /* 3d. TASK 9's TABLE PANEL, with its tab active on both pages. See TABLE_SELECTORS. */
    await Promise.all([openPanelTab(a, 'table'), openPanelTab(b, 'table')]);
    const [origTbl, builtTbl] = await Promise.all([
      capture(a, [], TABLE_SELECTORS),
      capture(b, [], TABLE_SELECTORS),
    ]);
    const tblCompared: string[] = [];
    compare(TABLE_SELECTORS, origTbl, builtTbl, tblCompared, boxDiffs);
    expect
      .soft(tblCompared.length, `only ${tblCompared.length} table selector(s) were compared`)
      .toBe(TABLE_SELECTORS.length);
    /* Guard the guard, the way the picker's height does for Compare. A table whose rows failed
     * to render measures a few px high and a th that never laid out measures 0 wide, and either
     * would compare 0 against 0 and pass. 55 rows of seventeen 10px/7px-padded headings is
     * ~900px tall and the first heading is at least 40px wide. */
    expect
      .soft(origTbl.boxes['#panel-table table.dt'].height, 'the original table must have real height')
      .toBeGreaterThan(400);
    expect
      .soft(origTbl.boxes['#panel-table table.dt th'].width, 'the original heading must have real width')
      .toBeGreaterThan(30);
    expect
      .soft(builtTbl.boxes['#panel-table table.dt'].height, 'the rebuilt table must have real height')
      .toBeGreaterThan(400);
    // Both pages must agree on the row count as well as on the box: a table with one row and
    // the right column widths would otherwise satisfy everything above.
    const rowCounts = await Promise.all(
      [a, b].map((p) => p.evaluate(() => document.querySelectorAll('#panel-table table.dt tbody tr').length)),
    );
    expect.soft(rowCounts[1], `row count: original ${rowCounts[0]} vs rebuild ${rowCounts[1]}`).toBe(rowCounts[0]);
    expect.soft(rowCounts[0], 'the original must have rendered its 55 rows').toBe(55);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s) including the table`).toEqual([]);

    /* 3e. TASK 10's REPORT PANEL, with its tab active on both pages. See REPORT_SELECTORS. */
    await Promise.all([openPanelTab(a, 'report'), openPanelTab(b, 'report')]);
    const [origRep, builtRep] = await Promise.all([
      capture(a, [], [...REPORT_SELECTORS, ...REPORT_REPORTED]),
      capture(b, [], [...REPORT_SELECTORS, ...REPORT_REPORTED]),
    ]);
    const repCompared: string[] = [];
    compare(REPORT_SELECTORS, origRep, builtRep, repCompared, boxDiffs);
    expect
      .soft(repCompared.length, `only ${repCompared.length} report selector(s) were compared`)
      .toBe(REPORT_SELECTORS.length);
    /* Guard the guard, the way the picker's height does for Compare and the row count for the
     * table. An empty `.brief` is 34px of padding twice over and nothing else, and it would
     * compare equal against an equally empty original. The real brief is a header, three rules,
     * a 23px figure grid and a wrapped paragraph: over 300px on both pages, at the fixed 640px
     * the stylesheet gives it. */
    for (const [who, cap] of [['original', origRep], ['rebuilt', builtRep]] as const) {
      expect.soft(cap.boxes['#panel-report .brief'].height, `the ${who} brief must have real height`).toBeGreaterThan(300);
      expect.soft(cap.boxes['#panel-report .brief'].width, `the ${who} brief must be 640px wide`).toBe(640);
      expect.soft(cap.boxes['#panel-report .brief h3'].width, `the ${who} city name must have real width`).toBeGreaterThan(20);
    }
    // The four 23px figures are ruling 20's subject; a brief rendered without them would still
    // clear the height floor above, so count them on both pages.
    const figureCounts = await Promise.all(
      [a, b].map((p) =>
        p.evaluate(() => {
          const els = [...document.querySelectorAll<HTMLElement>('#panel-report .brief div')];
          return els.filter((el) => getComputedStyle(el).fontSize === '23px').length;
        }),
      ),
    );
    expect.soft(figureCounts, 'both pages must render the four 23px brief figures').toEqual([4, 4]);
    expect.soft(boxDiffs, `${boxDiffs.length} box/type difference(s) including the report`).toEqual([]);

    /* §7.7's measurement, reported rather than asserted. Printed so it lands in the CI log and
     * in the task report; the only assertions are that it EXISTS and is non-zero on both pages,
     * so it cannot become a selector nobody looks at. */
    for (const sel of REPORT_REPORTED) {
      const o = origRep.boxes[sel];
      const r = builtRep.boxes[sel];
      expect.soft(o.present && r.present, `${sel} must be present on both pages`).toBe(true);
      expect.soft(o.height, `${sel} must have real height in the original`).toBeGreaterThan(0);
      expect.soft(r.height, `${sel} must have real height in the rebuild`).toBeGreaterThan(0);
      console.log(
        `[${theme}] §7.7 reported-only: ${sel} ` +
          `width ${o.width} vs ${r.width}, height ${o.height} vs ${r.height}`,
      );
    }
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
