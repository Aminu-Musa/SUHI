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
    why: "the state graticule used an unclipped d3.geoBounds extent - a RECTANGLE - so its 1.6 degree lines ran over Niger, Cameroon, Benin and the Bight of Benin. APPROVED BY THE USER ON 2026-10-24, reversing ruling 31: the layer is no longer a graticule at all. It draws the vector basemap's own admin-level-1 boundaries (kind=region, disputed excluded), so bug 6 is fixed by deletion rather than by clipping - there is nothing left to run anywhere and src/map/graticule.ts is gone. The §8.3 citation is here because the self-hosted vector basemap is what made real boundaries available at all. The treatment is still prototype line 625 exactly (--ui-muted, 1px, opacity .5, dashed 3 4) so the lines stay subordinate to the 2px national border, and the rail chip moved from 'placeholder' to '37'" },
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

export const ALLOWED_DIFFS: readonly AllowedDiff[] = [...FROM_SPEC_3, ...FROM_SPEC_8, ...FROM_SPEC_9];

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
export const PENDING: readonly { readonly selector: string; readonly task: number }[] = [
  // Task 8 - compare
  { selector: '.picker', task: 8 },
  { selector: '.pk', task: 8 },
  { selector: '.cmp', task: 8 },
  { selector: '.card2', task: 8 },
  // Task 9 - table
  { selector: 'table.dt', task: 9 },
  { selector: 'table.dt th', task: 9 },
  { selector: 'table.dt td', task: 9 },
  // Task 10 - reports
  { selector: '.brief', task: 10 },
  { selector: '.brief h3', task: 10 },
  { selector: '.expgrid', task: 10 },
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
