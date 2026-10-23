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
  { target: '.leaflet-overlay-pane path.stategrid', property: 'box', cite: 'spec §9.1 bug 6',
    why: 'state graticule used an unclipped d3.geoBounds extent, running over Niger and the sea' },
  { target: '.kpi.wide:last-of-type .val', property: 'exists', cite: 'spec §9.1 bug 7',
    why: 'the typology tile had no .val, breaking the tile grammar of the other five' },
  { target: '.kpis', property: 'box', cite: 'spec §9.1 bug 7',
    why: "the container of the tile that bug 7 fixes: a figure line cannot be added without the grid growing by it. Measured +26.00px in Nocturne (a 24px line box plus the sub's 2px top margin) and +9.73px in Modernist, where the shortened .sub reflows from two lines to one and recovers 16.27px. Exempting the .val's existence without its container's height would have made the bug-7 fix unshippable" },
  { target: '.citycircle', property: 'z-order', cite: 'spec §9.1 bug 10 / ruling 14',
    why: 'cityPane was 410, under the spot panes; docs specify 460, so circles now sit above' },
];

export const ALLOWED_DIFFS: readonly AllowedDiff[] = [...FROM_SPEC_3, ...FROM_SPEC_9];

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
export const PENDING: readonly { readonly selector: string; readonly task: number }[] = [
  // Task 6-7 - map and interactions
  { selector: '.citylabel', task: 7 },
  { selector: '.pill', task: 7 },
  { selector: '.rule', task: 7 },
  { selector: '.dl2', task: 7 },
  { selector: '.dl2 dt', task: 7 },
  { selector: '.dl2 dd', task: 7 },
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
export const CONTENT_PENDING: readonly { readonly selector: string; readonly task: number; readonly why: string }[] = [
  { selector: '#map', task: 6,
    why: "leaflet.css sets .leaflet-container{font-size:12px} once L.map('map') runs; the rebuild's #map is a bare div inheriting body's 13px until MapLibre mounts" },
  { selector: '.ovl', task: 6,
    why: '.ov-tl is position:absolute with max-width:60%, so its box is content-driven, and #zoomHint is empty until updateZoomHint runs (prototype line 739)' },
  { selector: '.mapsub', task: 6,
    why: 'same cause: #zoomHint is a .mapsub with no text until the exaggeration factor is known' },
];

export const contentPendingSelectors = new Set(CONTENT_PENDING.map((c) => c.selector));
