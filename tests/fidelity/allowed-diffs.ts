/* The ONLY sanctioned departures from project/nigeria-suhi-dashboard.html, and the selectors
 * that do not exist in the rebuild yet.
 *
 * Every ALLOWED_DIFFS entry carries the spec section or bug number that permits it. An uncited
 * entry is a defect (ruling 15): adding entries to quiet the guard is exactly how a fidelity
 * guard stops meaning anything, so the citation is the thing that keeps it honest. */

export interface AllowedDiff {
  /** Token name or CSS selector this exempts. */
  readonly target: string;
  /** Which property is allowed to differ, or 'box' / 'type' for geometry and typography. */
  readonly property: string;
  /** Spec section or §9.1 bug number. Required. */
  readonly cite: string;
  readonly why: string;
  /**
   * TASK 12, `property: 'count'` only: the sanctioned pair [original, rebuild].
   *
   * Required for a count entry, and it is what stops a count exemption becoming a blanket one.
   * `.note` is the case that demands it: the rebuild drops six export-card notes (§7.7) and
   * adds `#cmpLegend` (§7.5), netting 25 vs 20. An exemption that only said "this selector may
   * differ" would go on passing after someone deleted `#cmpLegend` as well - 25 vs 19 - which
   * is a real regression wearing a sanctioned difference's clothes. The guard requires the
   * observed pair to equal this one exactly.
   */
  readonly counts?: readonly [number, number];
}

/* Spec §3's Changed table - the four sanctioned changes. */
const FROM_SPEC_3: readonly AllowedDiff[] = [
  { target: '.kpi.hot .val', property: 'color', cite: 'spec §3 / §5.4',
    why: '--hot-4 -> --hot-4-ink; the fill value fails WCAG as text' },
  { target: '.kpi.cold .val', property: 'color', cite: 'spec §3 / §5.4',
    why: '--cold-4 -> --cold-4-ink; 2.49:1 against --ui-panel-2' },
  { target: '.seg button[aria-pressed=true]', property: 'background-color', cite: 'spec §3 / §5.6',
    why: '--color-accent -> --accent-fill so white-on-accent clears 4.5:1' },
  { target: '--hot-4-ink,--hot-5-ink,--cold-3-ink,--cold-4-ink,--cold-5-ink,--hot-1-ink,--hot-2-ink,--hot-3-ink,--cold-1-ink,--cold-2-ink,--accent-ink,--accent-fill',
    property: 'token-added', cite: 'spec §5.4 / §5.6',
    why: 'the ink scale and accent fill are new tokens; the original declares neither' },
];

/* The five §9.1 fixes that change rendered output (ruling 15). Unregistered, each would read as
 * drift rather than an approved correction. */
const FROM_SPEC_9: readonly AllowedDiff[] = [
  { target: '.drawer .bar i', property: 'box', cite: 'spec §9.1 bug 4',
    why: 'population bar was divided by the magic number 230; now proportional' },
  { target: '.kpi.wide .bar i', property: 'box', cite: 'spec §9.1 bug 5',
    why: 'share bar used Math.min(50, pct*6), proportional to nothing' },
  { target: '.leaflet-overlay-pane path.stategrid', property: 'box', cite: 'spec §9.1 bug 6 / spec §8.3',
    why: "the state graticule used an unclipped d3.geoBounds extent - a RECTANGLE - so its 1.6 degree lines ran over Niger, Cameroon, Benin and the Bight of Benin. APPROVED BY THE USER ON 2026-10-24, reversing ruling 31: the layer is no longer a graticule at all, so bug 6 is fixed by deletion rather than by clipping and src/map/graticule.ts is gone. TASK 12 FIXED THE SECOND HALF. Task 6 drew the layer from the vector basemap's own admin-level-1 lines (kind=region), which deleted the graticule but kept its extent problem: those features carry no country code, name or ISO field at any zoom in the extract, so Niger's, Benin's, Cameroon's and Chad's first-level divisions rendered inside the bbox too - visible in shot-task6-*.png and reported rather than clipped. The layer now draws data/boundaries/nga-adm1.topojson (geoBoundaries gbOpen ADM1, ODC-ODbL 2025-08-26), which is Nigeria-only BY CONSTRUCTION: 37 features, 36 states plus the FCT, every one shapeGroup NGA, validated in src/map/boundaries.ts against the shipped bytes - so the style carries no filter at all, because there is nothing foreign to exclude. The national outline STAYS on the basemap (ruling 30). The §8.3 citation remains because the self-hosted vector basemap is what retired the world-atlas CDN this layer used to share a fetch with. The treatment is still prototype line 625 exactly (--ui-muted, 1px, opacity .5, dashed 3 4) so the lines stay subordinate to the 2px national border, and the rail chip is '37' rather than 'placeholder'" },
  { target: '.kpi.wide:last-of-type .val', property: 'exists', cite: 'spec §9.1 bug 7',
    why: 'the typology tile had no .val, breaking the tile grammar of the other five' },
  { target: '.kpis', property: 'box', cite: 'spec §9.1 bug 7',
    why: "the container of the tile that bug 7 fixes: a figure line cannot be added without the grid growing by it. Measured +26.00px in Nocturne (a 24px line box plus the sub's 2px top margin) and +9.73px in Modernist, where the shortened .sub reflows from two lines to one and recovers 16.27px. Exempting the .val's existence without its container's height would have made the bug-7 fix unshippable" },
  { target: '.citycircle', property: 'z-order', cite: 'spec §9.1 bug 10 / ruling 14',
    why: 'cityPane was 410, under the spot panes; docs specify 460, so circles now sit above' },
];

/* Spec §8.3, APPROVED BY THE USER ON 2026-10-23 - the first exemption authorised by the user
 * rather than by §3's Changed table or §9.1's bug list, and the one that overrides ruling 25.
 *
 * The five Esri raster basemaps are replaced by one self-hosted Protomaps vector basemap styled
 * from THEME_TOKENS. Five raster PROVIDERS become three vector variants (palette plus density:
 * Dark, Topo, Plain), because there is one provider now and `Relief` and `Imagery` have no
 * vector counterpart - shaded relief is a raster product and imagery is photographs, so a
 * synthesised version of either would be a label making a claim about data that is not there.
 *
 * `.seg button{flex:1}`, so three buttons are wider than five, and `.seg button` is a measured
 * selector whose first match in the document is #baseSeg's first button. That width is the only
 * thing this exempts: TYPE_PROPS are still compared (the inline font-size:10.5px still has to
 * match), and the `.seg` container itself is not exempt because it is full-width in both. */
const FROM_SPEC_8: readonly AllowedDiff[] = [
  { target: '.seg button', property: 'box', cite: 'spec §8.3',
    why: "the basemap segment's own geometry. The original offers five Esri providers; the rebuild offers two vector grounds (ruling 39), so each button is wider. Re-measured after ruling 39 cut three options to two: 56.67 -> 144.70 px in Nocturne and 53.59 -> 137.00 px in Modernist, with the `.seg` container identical on both pages. The earlier figures in this entry were taken with three buttons and were stale the moment the user chose two" },
];

/* Task 8's Compare changes, measured and brought to me rather than registered by the implementer. */
const FROM_TASK_10: readonly AllowedDiff[] = [
  { target: '#panel-report .expgrid', property: 'box', cite: 'spec §7.7',
    why: "six export cards become one select plus a Download button that appears after a format is chosen - the user's own adjustment to the original, kept. Measured: width is IDENTICAL on both pages (572.83 Nocturne, 544.00 Modernist) and only the height differs, 316.42 to 28 and 360.92 to 30, because six stacked cards collapse to one control row. The container and its column position are unchanged, which is what §7.7 asked for" },
];

const FROM_TASK_8: readonly AllowedDiff[] = [
  { target: '#panel-compare .card2', property: 'box', cite: 'spec §7.5',
    why: "the clustered chart's own geometry: nine measures each gain a second bar row, so the card is +151.69px taller in Nocturne and +151.68px in Modernist. Everything else about the card - surface, padding, radius, the 11.5px row type - matches" },
  { target: '#panel-compare .cmp', property: 'box', cite: 'spec §7.5',
    why: 'the grid containing the cards above; it grows by exactly the same amount and for the same reason' },
  { target: '#cmpLegend', property: 'exists', cite: 'spec §7.5',
    why: 'an element the original has no equivalent for. §7.5 fixes both bar gradients, so day and night are distinguished only by opacity, and without a key the pairing is unreadable. A chart that cannot be read is not a faithful rendering of one that could' },
  { target: '#panel-compare .card2 > div:first-child span', property: 'text', cite: 'spec §9.1 bug 11',
    why: 'the sign fix: the original renders `+-0.66 °C` for the 18 negative cities, while formatting the same value correctly at prototype lines 812, 861 and 886' },
];

/* ══ TASK 12: MATCH COUNTS, AND THE THREE PER-MATCH EXEMPTIONS ══
 *
 * `tests/fidelity/measure.ts` measured only the FIRST match of each selector until this task
 * (Task 5 found it; the note at the top of that file says what it cost). With every match
 * compared and every count checked, the guard reported eleven differences it had never been
 * able to see. All eleven are sanctioned changes that no entry existed for, because until now
 * nothing could detect them - so they are registered here with the section that permits each.
 *
 * NONE OF THE ELEVEN IS A NEW DEPARTURE. Each is a consequence of a change already approved
 * and already cited elsewhere in this file; what is new is that the guard can now see them.
 *
 * A PER-MATCH TARGET is written `selector «n»`, the key `matchKey` builds, and exempts that one
 * match. The grain matters: §9.1 bug 7 is about the LAST KPI tile, so `.kpi «6»` is the honest
 * target and a blanket `.kpi` entry would stop comparing all six boxes to excuse one. */
/* THE REGISTER, not the comparison. This file opens by calling itself "the ONLY sanctioned
 * departures", and the guard compares no colour at all - `.kpi.hot .val` and `.kpi.cold .val`
 * above are registered for exactly that reason: they are the human-readable answer to "what
 * differs from the approved page". Task 12 changed the rendered colour of four more elements
 * and has to say so here, or the list stops being that answer.
 *
 * All four are the SAME change: accent used as TEXT takes the ink token (§3's second table,
 * "a parallel *-ink scale for every text usage", worked out in §5.2-§5.5). §5.2's inventory was
 * built from the prototype's render functions and so never reached the stylesheet's own accent
 * text; `src/styles/accent-text.test.ts` is the guard, and these are the register. */
const FROM_TASK_12_COLOURS: readonly AllowedDiff[] = [
  { target: '.pk[aria-pressed=true]', property: 'color', cite: 'spec §3 / §5.4',
    why: "the selected Compare pickers, `--color-accent` on a 12% accent wash: 3.17:1 in Modernist, found by axe on the default view of the Compare tab while the contrast audit reported 80 of 80 green. Now `--accent-ink` at 4.53. The border and the wash keep the FILL token, because only text moved" },
  { target: '.ghost[aria-pressed=true]', property: 'color', cite: 'spec §3 / §5.4',
    why: 'the Framed toggle while it is on: accent text on `--color-bg`, 3.76:1 in Modernist. Now `--accent-ink` at 5.31. Its border is unchanged' },
  { target: '.zbtn:hover', property: 'color', cite: 'spec §3 / §5.4',
    why: 'the three map buttons under the pointer, accent text on `--color-bg`. Same pair, same ratios as the Framed toggle; axe cannot test a hover state, so this one was found by reading the stylesheet rather than by measuring the page' },
  { target: '.swipe .grab', property: 'color', cite: 'spec §3 / §5.4',
    why: "the swipe handle's ⇄ glyph, 11px accent on `--color-bg`. The smallest of the four and the same substitution" },
];

const FROM_TASK_12_COUNTS: readonly AllowedDiff[] = [
  { target: '.ghost', property: 'count', counts: [8, 2], cite: 'spec §7.7',
    why: "the original's export panel held SIX `.ghost` Download buttons, one per export card, and ruling 40 found that none of them downloaded anything - they were a promise the UI made and did not keep. §7.7's export is one `#exportFormat` select plus a single Download button that is ABSENT until a format is chosen (not disabled: a disabled control is something a reader can see and cannot use), so at first paint the rebuild has only the header's `#frameToggle` and `#exportBtn`. `.expgrid`'s own box exemption below is the same change measured from the container's side" },
  { target: '.mini-sel', property: 'count', counts: [2, 3], cite: 'spec §7.7',
    why: 'the third is `#exportFormat`, the select that replaced the six export cards. The original has only the header pair (`#lang`, `#theme`); the class is reused rather than invented, because §7.7 asked for the export control to look like the page it sits on' },
  { target: '.kpi .val', property: 'count', counts: [5, 6], cite: 'spec §9.1 bug 7',
    why: 'the sixth is the one bug 7 adds. The "Typology & confidence" tile was the only one of the six with no `.val`, which broke the tile grammar of the other five; the fix moves `0.64 °C` out of its `.sub` and into a `.val`. `.kpi.wide:last-of-type .val` already carries an `exists` entry for the same fix - this is its count' },
  { target: '.seg button', property: 'count', counts: [14, 11], cite: 'spec §8.3',
    why: "the basemap segment had FIVE buttons - Dark, Topo, Relief, Gray, Imagery - one per Esri/Carto tile service. §8.3 retired those services for a self-hosted Protomaps extract, which ships two styles, so the segment has two: Dark and Light. The other three segments are unchanged at 4, 2 and 3. `.seg button`'s box entry below cites the same section for the same reason" },
  { target: '.note', property: 'count', counts: [25, 20],
    cite: 'spec §7.7 / spec §7.5',
    why: "two sanctioned changes netting five: §7.7 drops the six per-card notes with the six export cards, and §7.5 adds `#cmpLegend`, the one element in the Compare panel that is not in the original - it says which bar is day and which is night, which the doubled bars made necessary (`#cmpLegend` has its own `exists` entry below). The rail's seven and the brief's three are unchanged, including `basemap_note`, whose TEXT changed with §8.3 while its element did not" },
  { target: '.card2', property: 'count', counts: [10, 4], cite: 'spec §7.7',
    why: "four Compare cards in both pages; the original's other six are the export cards §7.7 collapses into one control row. `#panel-compare .card2` carries a box entry for the four that remain, and `#panel-report .expgrid` for the row that replaced the six" },
  { target: '.cbar .track', property: 'count', counts: [45, 81], cite: 'spec §7.5',
    why: 'nine in the rail on both pages. In Compare the original draws one bar per measure per card (9 x 4 = 36) and §7.5 doubles them, day against night (9 x 2 x 4 = 72), which is the change `#cmpLegend` exists to label' },
  { target: '.cbar .v', property: 'count', counts: [45, 81], cite: 'spec §7.5',
    why: 'the fill inside each `.cbar .track`, so it follows that count exactly - see the entry above' },
];

/* The three per-match box exemptions the count work surfaced. Each is a box difference at ONE
 * match of a repeated selector, and each is the geometric consequence of a change already
 * sanctioned above or elsewhere in this file. */
const FROM_TASK_12_MATCHES: readonly AllowedDiff[] = [
  { target: '.kpi «6»', property: 'box', cite: 'spec §9.1 bug 7',
    why: "the sixth tile is 72.63px tall in the original and 82.36px here (82.25 / 91.98 in Modernist), because bug 7's fix gives it the `.val` the other five have. `.kpis` already carries a box entry for the grid this makes taller; this is the tile itself. The other five `.kpi` boxes are compared and match" },
  { target: '.kpi .sub «5»', property: 'box', cite: 'spec §9.1 bug 7',
    why: 'the same fix seen from the other side: the fifth `.sub` reads "0.64 °C · 16 clusters · city-level" in the original and wraps to two lines (32.53px), while here the figure has moved up into the new `.val` and the `.sub` is one line (16.27px). Four `.sub` boxes are compared and match' },
  { target: '.ly .chip «4»', property: 'box', cite: 'spec §9.1 bug 6 / spec §8.3',
    why: 'the states chip, 64.97px wide reading "placeholder" and 23.25px here reading "37". The layer WAS a placeholder - a 1.6-degree graticule - and the user approved real ADM1 boundaries on 2026-10-24, reversing ruling 31; a chip still reading "placeholder" would be the only thing on screen contradicting the 37 features now drawn. Same citation as the `path.stategrid` entry above, which is the layer itself' },
];

export const ALLOWED_DIFFS: readonly AllowedDiff[] = [
  ...FROM_SPEC_3,
  ...FROM_SPEC_8,
  ...FROM_SPEC_9,
  ...FROM_TASK_12_COLOURS,
  ...FROM_TASK_12_COUNTS,
  ...FROM_TASK_12_MATCHES,
];

/* Attributes and properties the guard NEVER compares, with the reason each is excluded. */
export const IGNORED_PROPERTIES: readonly { readonly name: string; readonly why: string }[] = [
  { name: 'id', why: 'Radix renders generated ids (radix-_r_0_-trigger-map) that the original lacks and that change every run (ruling 21)' },
  { name: 'aria-controls', why: 'cleared deliberately: the original tabs control nothing by id' },
];

/* Selectors the rebuild has not built yet, each tagged with the task that claims it.
 *
 * The guard SKIPS a pending selector, and FAILS if a pending selector now matches in the
 * rebuild - so the list cannot rot into a permanent exemption (ruling 2). Task 12 asserts it is
 * empty. Tasks 4-10 each delete their own lines; nobody deletes someone else's. */
/* `.bar` was tagged task 5 and is NOT in this list: the first `.bar` in the document is the KPI
 * share bar, which task 4 renders (prototype line 1046), and nothing in rail groups 6-10 has
 * one. Task 4 deleted that line because the guard's own failure message asks the task that
 * makes a selector exist to delete it, and deleting it makes the guard COMPARE `.bar` rather
 * than skip it - strictly more coverage, never a silenced selector. Task 7's drawer bars are
 * covered separately by the `.drawer .bar i` entry above. */
/* TASK 7 DELETED ITS SIX ENTRIES - `.citylabel`, `.pill`, `.rule`, `.dl2`, `.dl2 dt` and
 * `.dl2 dd` - and all six are now compared.
 *
 * `.citylabel` joins the main pass: ruling 13's DOM overlay renders one per city on load, in
 * cities.json order, so the first match is the same city on both pages.
 *
 * THE OTHER FIVE ONLY EXIST WHILE THE DRAWER IS OPEN, on BOTH pages, so deleting them plainly
 * would have made the guard skip them for ever - "absent in the original too: nothing to hold
 * the rebuild to" is the branch they would have taken. They moved to `DRAWER_SELECTORS` in
 * fidelity.spec.ts instead, which opens a city on each page and then measures. And they are
 * scoped to `.drawer`: Task 5 found that the guard reads only the FIRST match of a selector,
 * and `.dl2` already exists in the RAIL behind a non-default cluster selection, so a bare
 * `.dl2` would one day verify the rail's list and declare the drawer correct. */
/* TASK 8 DELETED ITS FOUR ENTRIES - `.picker`, `.pk`, `.cmp` and `.card2` - and all four are
 * now compared. Two things about them are worth knowing before you read the guard.
 *
 * `.card2` IS A TRAP, and it is Task 5's first-match limitation again. `.card2` already exists
 * in the RAIL behind a non-default cluster selection (src/rail/ClusterSelect.tsx), so a bare
 * `.card2` could one day verify the rail's cluster card and declare the Compare card correct.
 * On BOTH pages the rail's default branch renders `.cbar` rows and no `.card2`, so today the
 * first match really is Compare's first card on each - but the COMPARE pass in fidelity.spec.ts
 * scopes every selector to `#panel-compare` so that stops being luck.
 *
 * THE COMPARE PANEL IS `display:none` ON THE MAP TAB, which is the tab both pages load on. A
 * display:none element still resolves every computed property, so the main pass compares all
 * five TYPE_PROPS and all six BOX_PROPS for real - but `getBoundingClientRect()` is 0x0 on both
 * pages, so its width and height comparisons are 0 vs 0 and hold nothing down. Hence COMPARE_
 * SELECTORS below: a third pass that switches both pages to the Compare tab and measures the
 * geometry where it actually exists. */
/* TASK 10 DELETED ITS THREE ENTRIES - `.brief`, `.brief h3` and `.expgrid` - and all three are
 * now compared. The main pass takes their type and box properties; REPORT_SELECTORS in
 * fidelity.spec measures `.brief` and `.brief h3` on the Reports tab, where they have real
 * geometry rather than the 0x0 a display:none panel reports.
 *
 * `#panel-report .expgrid` is measured in that pass too but is REPORTED rather than asserted,
 * and that is deliberate: spec §7.7 replaces the six `.card2` cards inside it with one select
 * plus a Download button, so the grid's height cannot match and the difference is the change
 * working. It is NOT registered here - the measurement goes in the task 10 report for a ruling,
 * the way Task 8 brought `.cmp`'s and `#panel-compare .card2`'s heights rather than exempting
 * them itself. Its own CSS - the auto-fit minmax(210px,1fr) grid, its gap and its margin - is
 * compared in the main pass and matches. */
export const PENDING: readonly { readonly selector: string; readonly task: number }[] = [
  /* Task 9's three - `table.dt`, `table.dt th`, `table.dt td` - are GONE from this list. The
   * main pass now compares their type and box properties, and TABLE_SELECTORS in fidelity.spec
   * measures their real geometry on the Data table tab, for the same display:none reason the
   * note above gives for Compare. */
];

export const pendingSelectors = new Set(PENDING.map((p) => p.selector));

/* Selectors that EXIST in the rebuild but whose geometry or type cannot match yet, because a
 * later task supplies the content that sizes them. Distinct from PENDING, which means the
 * element is absent: these are present, so PENDING's anti-rot check would fire on them
 * immediately and the distinction is the only thing that keeps that check meaningful.
 *
 * The guard requires them PRESENT, skips their box and type, and Task 12 asserts this list is
 * empty - so "content comes later" cannot quietly become "we never compared it". */
/* TASK 6 DELETED ITS THREE ENTRIES - `#map`, `.ovl` and `.mapsub` - and all three are now
 * compared. They were here because none of them could be SIZED until a map existed: `#map` had
 * no `.leaflet-container` type to inherit, and `.ovl`'s height and `.mapsub`'s width both
 * depend on `#zoomHint`, which stayed empty until the exaggeration factor was known. The map
 * mounts, `ZoomHint` renders ruling 9's disclosure, and `#map`'s type is pinned in app.css next
 * to the Leaflet rules it mirrors - so the reason is gone and so are the lines. */
export const CONTENT_PENDING: readonly { readonly selector: string; readonly task: number; readonly why: string }[] = [];

export const contentPendingSelectors = new Set(CONTENT_PENDING.map((c) => c.selector));
