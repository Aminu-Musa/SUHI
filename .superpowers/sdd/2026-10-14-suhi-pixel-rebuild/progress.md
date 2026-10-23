# SDD ledger — plan: docs/superpowers/plans/2026-10-14-suhi-pixel-rebuild.md

**Spec:** `docs/superpowers/specs/2026-10-14-suhi-dashboard-pixel-rebuild-design.md` (the binding authority)
**Branch:** `feat/pixel-rebuild`, forked from `main` at `cac0bd4`
**Execution:** subagent-driven, 12 tasks. User instruction: report at each task boundary.

---

## Pre-flight conflict scan

### Pairs sharing a file or an interface

| Tasks | Produces → consumes | Finding |
| --- | --- | --- |
| 1 → 2,4,5,6,7,8,9,10 | `suhi-tokens.css`, `ink.css`, `THEME_TOKENS` | Clean. T1 lands alone and first. |
| 1 → 1 | `audit-contrast.mjs` imports `buildRamp, RAMPS` from `ramps.mjs`, which Step 9 deletes | **Ordering hazard.** Step 7 (rewrite audit) must drop that import before Step 9 (delete). Plan already orders them 7→9; recorded so an implementer does not reorder. |
| 1 → 6 | `--neutral-mid` | **CONFLICT — ruling 1.** |
| 2 → 4,5,6,10,11 | `State`, `useAppState`, `useT` | Clean. One definition, T2. |
| 2 → 7 | `paintEpoch` | Clean. Single consumer. |
| 2 → 11 | `src/app/state.ts` — T2 creates, T11 modifies | Clean, sequential. |
| 2 → 3 | shell markup/CSS that T3 measures | **CONFLICT — ruling 2.** |
| 3 → 4..10 | `ALLOWED_DIFFS`, the fidelity run | **CONFLICT — ruling 2.** |
| 4 → 5,8 | `Seg` | Clean. T4 defines, both reuse. |
| 4 → 2 | T4's KPI ink test depends on T2 Step 5's `.kpi.hot .val` edit | Clean, ordered 2→4. |
| 6 → 7 | map instance, paint expressions | Clean. |
| 7 → 9 | `focusCity` | Clean. T9's row-click test consumes it. |
| 4,5 → 6 | `state.layers`, `.opacity`, `.year`, `.popMode`, `.circleMetric` | Clean — all typed in T2's `State`. |
| 1 → 12 | `npm run ink` in T12's full-suite step | Clean. |
| 12 → all | a11y sweep over every tab | Clean, last. |

### Task self-consistency

| Task | Tests vs code vs files | Finding |
| --- | --- | --- |
| 1 | Ink table is the contract; step size 0.002 stated | Agrees. |
| 2 | Creates `state.ts`, tested in T11 not T2 | Acceptable — T2 tests the shell, T11 tests URL sync. Noted, not a defect. |
| 3 | "Expected: PASS with zero diffs" vs Step 3 "rail reports missing elements" | **Self-contradictory — ruling 2.** |
| 4 | Zero-spot test needs a filter combination that yields zero | Verify such a combination exists in real data — assigned to T4's implementer. |
| 5 | Legend asserts fill tokens, not ink | Agrees with spec §6.3. |
| 6 | `null` + clamp + unfiltered refs | Agrees. |
| 7 | Repaint test compares against a fresh build | Agrees. |
| 8 | National-max scaling test | Agrees with spec §7.5. |
| 9 | 17 columns, ink scale | Agrees. |
| 10 | Export encoding fixture | Agrees. |
| 11 | Deep-link validation | Agrees. |
| 12 | Bug 9 already closed | Corrected in the plan before execution. |

---

## Rulings

**Ruling 1 — `--neutral-mid` is a literal hex, not a `var()` reference.**
Plan Task 1 Step 5 said `--neutral-mid: var(--color-neutral-800)` (Nocturne) and
`var(--color-neutral-400)` (Modernist). But Task 6 resolves token names to colours
through `THEME_TOKENS` in JavaScript to build MapLibre paint expressions, and JS cannot
resolve a CSS `var()`. A `var()` reference would reach MapLibre as the literal string
`"var(--color-neutral-800)"` and produce an invalid paint value.
**Decision:** `--neutral-mid` is declared as the concrete hex in both the CSS and
`THEME_TOKENS` — `#3f424d` Nocturne, `#bab6b6` Modernist — with a comment at each
declaration stating it equals `--color-neutral-800` / `--color-neutral-400` and a test
asserting that equality, so the two cannot drift.
*Cost if wrong:* a duplicated constant, caught by its own test.
*Note:* the outgoing `palette.test.mjs` skipped `--neutral-mid` because it was generated
into `_ramps.css` — evidence this token has already been a seam once.

**Ruling 2 — the fidelity guard ships with an explicit PENDING list, not a red suite.**
Plan Task 3 said to run the guard and "record that list in the ledger as the task's
starting debt", while also expecting PASS. Those cannot both hold: committing a guard
that fails for every rail and panel selector leaves CI red for Tasks 4–10, and a task
whose suite is red is not a task a reviewer can approve.
**Decision:** `tests/fidelity/allowed-diffs.ts` gains a second export,
`PENDING: string[]` — selectors not yet implemented. The guard skips a PENDING selector
and **fails if a PENDING selector now exists and matches**, so the list cannot rot. Each
of Tasks 4–10 removes its own selectors from PENDING as it builds them, and Task 12
asserts `PENDING` is empty. `ALLOWED_DIFFS` stays what it is: sanctioned permanent
departures, each citing a spec section.
*Cost if wrong:* one extra export and a per-task bookkeeping step, in exchange for a
green suite at every commit.

**Ruling 3 — the unscoped vendored base layer is reproduced, not scoped.**
The user was asked whether to take this call or leave it to me, and answered "continue".
**Decision:** reproduce it exactly, per spec §3 — the original is the authority, and
Modernist's base rules applying in both themes is what the approved page renders. It
stays listed under the plan's carried-forward decisions, so flipping it later is one
edit per vendored file plus an `ALLOWED_DIFFS` entry.
*Cost if wrong:* Nocturne keeps base typography it was not designed with — visible as
`body`/`h1`–`h6` metrics, and reversible in one edit.

---

## Task log

### Task 1 — token layer, ink derivation, retargeted audit

- Implementer commit: `c553a28`
- Controller verification (run independently, not taken from the report): `npm test` 81 passed / 7 files; `npm run audit` exit 0, 80 pairs; `npm run ink` then `git diff --exit-code src/styles/ink.css` clean.
- Task review: **PASS on both verdicts** (spec compliance, code quality). No blockers.
  Reviewer independently reimplemented the ink derivation and agreed; confirmed
  `deriveInk('#333333')` computes rather than looks up; counted 80 pairs as correct
  (2 x 13 x 3 + 2); confirmed `suhi-tokens.css` reproduces both prototype blocks at
  53/53 tokens with zero value differences; confirmed all five deletions are gone with
  no dangling import; confirmed the two unaudited text grounds (`--color-surface`,
  `--ui-panel`) clear 4.5 a fortiori, so the three-ground list is not an under-audit.
- Fix round 1 dispatched to the same implementer: six findings.
  1. MEDIUM - nothing guarded the `@import "./ink.css"` line; deleting it left the suite
     green and the audit at exit 0 while every ink token was undefined in the browser.
     A guard regression: the deleted `palette.test.mjs` asserted this for `_ramps.css`.
  2. MEDIUM - `THEME_TOKENS` completeness unguarded in both directions; Task 6 would
     read `undefined` into MapLibre paint.
  3. LOW/MEDIUM - selector-uniqueness and duplicate-declaration guards were lost with
     `palette.test.mjs`; a second appended theme block would diverge from what the
     audit measures.
  4. LOW - test name said "21 values" for 22 asserted.
  5. LOW - the hex-only invariant's comment blamed MapLibre; `parseHex` is the real
     constraint.
  6. TRIVIAL - the `--accent-fill` row id does not match the documented shape.

**Ruling 4 - the ink token count is 11 names per theme, 22 values in all.**
Finding 4 is my arithmetic error, not the implementer's: ten ramp ink tokens plus
`--accent-ink` is 11 per theme, 22 across both, and I wrote "21" in spec §5.4 and §9.2,
which propagated into the plan, the brief and the test name. Corrected in `docs/` by me;
the implementer renames the test to state the invariant rather than a bare number.
*Cost if wrong:* none behavioural - every asserted value was always correct.

**Ruling 5 - "the rail stays mounted" means mounted in the DOM, NOT visible.**
Found while preparing the Task 2 dispatch. The original's `selectTab` (prototype line
1020) sets `rail.style.display` and `stage.style.display` to `none` on every tab except
Map. Spec §7.1 says "the rail stays mounted across all four tabs" and the plan's Task 2
test said "the rail stays mounted on every tab" - both of which an implementer could
reasonably read as "stays visible", which would be a visible fidelity break on three of
the four tabs.
**Decision:** the rail and the stage stay **mounted** (React keeps them in the tree so
their state survives a tab change) and are **hidden** on compare/table/report, exactly
as the original hides them. Spec §7.1 and the Task 2 test are both reworded to say
"mounted but hidden". The test must assert the computed display, not merely presence.
*Cost if wrong:* the rail would render beside three panels it was never designed to
share a row with - caught immediately by the Task 3 fidelity guard, but only after
Task 2 shipped.

**Ruling 6 - theme and language persist to `localStorage`, and that is in scope.**
The original reads `suhi.theme` (default `nocturne`) and `suhi.lang` (default `en`) at
startup and writes them on every change (prototype lines 546, 557, 1015, 1017). The plan
did not mention persistence at all.
**Decision:** reproduce it, same two keys, same defaults. Reads must tolerate a
throwing or empty `localStorage` (private mode, blocked storage) and fall back to the
defaults rather than failing to boot. Pinned by a test in Task 2.
*Cost if wrong:* a returning user loses their theme - small, but it is behaviour the
original has and the fidelity guard cannot see.

**Ruling 7 - theme change auto-switches the basemap, latched by an explicit user pick.**
`applyTheme` calls `setBase(theme === 'nocturne' ? 'dark' : 'topo')` **only while**
`userPickedBase` is false; any click in `#baseSeg` sets that latch true, permanently
(prototype lines 561, 577, 665). The plan's Task 2 `paintEpoch` design covers repainting
but not this coupling, and Task 6 owns `setBase`.
**Decision:** the latch is part of `State` (`userPickedBase: boolean`, initial `false`),
set by the basemap segment in Task 4 and read by the theme effect. Task 2 defines the
field and the effect; Task 6 implements `setBase`. Pinned by two tests in Task 2: theme
change moves the basemap while the latch is false, and does not once it is true.
*Cost if wrong:* either the basemap stops following the theme, or it overrides a choice
the user made - the second is the worse failure and the reason the latch exists.

**Not a finding:** the original's `applyI18n` assigns `innerHTML`, but no dictionary
value in `src/i18n/dictionary.mjs` contains markup (checked: zero matches for a tag).
Task 2 renders translated strings as plain React children. Do not reach for
`dangerouslySetInnerHTML`.

- Fix round 1 commit: `3c7cae5`. Controller-verified: 87 tests / 7 files (was 81),
  audit exit 0 at 80 pairs, and `ink.css` + `suhi-tokens.css` **byte-identical** to
  `c553a28` - the round added guards and changed no value.
- Scoped re-review: **all six findings ADDRESSED, nothing regressed.** The reviewer
  performed four mutations itself (import removal, duplicate theme block, duplicate
  declaration, extra CSS token), reverted each, and confirmed a clean tree and no
  weakened guard.
- Finding 6: the implementer declined to conform the `--accent-fill` row id and
  documented the exception instead, on the grounds that white is not a declared token in
  either authored block, so conforming would mean inventing a token name this system does
  not have (`--on-accent` existed only in the deleted "Field" set). Re-reviewer agreed.
  A test now permits a hex foreground slot only on `--accent-fill` rows, exactly one per
  theme, so the exception cannot spread. **Accepted.**
- Carried forward to Task 6's brief: `THEME_TOKENS` holds hex-valued tokens only, enforced
  by a test, because the audit's `parseHex` requires `#rrggbb`. If the map needs scale or
  non-hex values in JS, add a second export rather than loosening the invariant.
- Carried forward to Task 2's reviewer: fixes 1-3 guard `src/styles/suhi-tokens.css`
  structure from a test under `scripts/lib/`. Both implementer and re-reviewer judged this
  acceptable for now and flagged `src/styles/*.test.mjs` as the better home if Task 2 adds
  more CSS structure rules. Watch for that.

**Task 1: complete.**

**Ruling 8 - spec §5.2's usage inventory was wrong in four ways. The remedy was not.**
Found while pre-flighting Tasks 4, 6 and 8 against the prototype.

1. **`.kpi .val` is not uniformly 24px.** Three of the six tiles override it inline:
   the share tile at 19px and the two population tiles at 20px. Only the hot/cold count
   tiles use the stylesheet's 24px.
2. **The large-text floor therefore differs per theme for the SAME element**, because the
   two design systems set different heading weights. WCAG large text is >=24px at any
   weight, or >=18.66px when bold. Nocturne's `--font-heading-weight` is 500, so its 19px
   and 20px figures are **body text at 4.5:1**; Modernist's is 800, so the same figures
   are **large text at 3.0:1**. The spec recorded a single 3.0 floor for all of them.
3. **`.cbar .v` is not coloured at all** - it is a bare `<span class="v">` inheriting
   `--color-text`. Three rows in §5.2 attributed ramp colours to it. That usage does not
   exist; the real coloured text in Compare is the 13px per-card SUHI figure
   (`hotScale`), the 11px cluster note (`--color-accent`), and a 19px footer trio
   (`--hot-4` / `--cold-4`).
4. The confidence bars in `renderKPIs` use `--hot-5`, `--hot-3`, `--hot-1` and
   `--color-neutral-500` as **track fills**, not text - correctly out of the text audit,
   but the spec never said so.

**Decision:** correct §5.1 and §5.2 to state the per-theme floor rule and the real usage
inventory. **Change nothing about the ink scale.** Every ink token clears 4.5:1 on all
three grounds in both themes, which is the strictest floor any of these usages can take,
so the derived values were already correct and remain sufficient - they were never
contingent on the size or weight analysis being right.

That is the substantive point, and it is an argument for the approach rather than an
excuse for the error: a parallel ink scale is robust to exactly this class of
mis-analysis, where per-usage patching would have shipped a value tuned to a 3.0 floor
that the same element takes at 4.5 in the other theme. Had §5 patched tokens per usage
as revision 1 did, items 1-3 would each have produced a real contrast failure.
*Cost if wrong:* none to the implementation; the spec would have misled a later reader
into thinking 3.0 suffices for a 19px figure in Nocturne.

## Task 6 pre-flight — four defects in the plan

**Ruling 9 - geometry exaggeration is KEPT, not replaced. The plan was wrong.**
Plan Task 6 Step 4 said the original's `exaggerate()` / `EXAG` "was a Leaflet workaround
for small polygons at low zoom. Replace it with a zoom-interpolated outline width."
That is false and would have been the worst regression in the project.

`exaggerate()` scales the **real geometry** about each polygon's own centroid by 9x, 6x,
4x and 2.2x at zooms 5, 6, 7 and 8 (prototype lines 710-721). The code comment states the
reasoning outright: a median spot is 12.7 km2, about 3px across at national zoom, and
rather than substitute a symbol the original scales the true shape so "the shape, nesting
and colour stay true, only the size is exaggerated, and the factor is stated on screen."
The disclosure is real: `updateZoomHint` writes `hint_zoom` ("Real polygon shapes, scaled
{k} about their centroids...") or `hint_true`, and both strings exist in all four
languages in `src/i18n/dictionary.mjs`.

Replacing it with outline width would render ~3px spots at the default national view -
an effectively empty map on the primary screen - and orphan eight translated strings.
**Decision:** reproduce the exaggeration exactly, same factors, same buckets, same
on-screen disclosure. Under MapLibre there is no paint property that scales a polygon
about its centroid, so it stays a geometry transform, applied on **zoom-bucket change**
via `source.setData()` - five discrete buckets (z5, z6, z7, z8, z>=9), not per-frame.
That still removes the original's per-tick `clearLayers()`/`addData()` teardown, which was
the actual Leaflet problem.
*Cost if wrong:* the map's main view shows nothing, and the feature's own disclosure text
contradicts the screen.

**Ruling 10 - nesting opacity must be reproduced; the plan never mentioned it.**
`spotOpts` multiplies fill opacity by `[.45, .72, 1][LEVEL_ORDER[contour_level]]` when
`state.contour === 'all'`, and by 1 otherwise (prototype lines 672-675). This is how
nesting reads: L50 faintest, L90 solid, so the dense core shows through its own envelope.
**Decision:** reproduce it as a `fill-opacity` expression keyed on `contour_level`,
multiplied by `state.opacity`, and switched by whether the contour filter is `all`.
Pinned by a test asserting all three multipliers and the `all`-only condition.
*Cost if wrong:* 441 polygons render as flat overlapping blobs and the three-level
structure - the point of the dataset - becomes unreadable.

**Ruling 11 - the non-significant outline is thicker as well as dashed.**
`weight: bh_significant ? boost : boost + .4`, where `boost` is 2.2 below zoom 8, 1.6
below 11, else 1.1. Spec §6.3 said only "outline weight: zoom-interpolated", missing both
the exact buckets and the +0.4.
**Decision:** reproduce all of it - the three zoom buckets and the +0.4 for
non-significant, alongside the dash. Note that spec §6.3's change to outline **colour**
(encoding `spot_type` instead of the original's "outline = fill when significant") is
sanctioned by §3 and replaces that behaviour; it does not stack with it.
*Cost if wrong:* significance stops being legible at a glance, which §6.3 treats as
load-bearing.

**Ruling 12 - the year slider back-casts the encoded value, and the plan dropped it.**
The original colours by `spotValue(p) = (suhii || 0) - (2024 - year)/10 * sen_slope`,
so the 2015-2024 slider back-casts each spot from its own Sen slope. `encodeValue` in
`src/lib/encode.mjs` takes `(props, refs)` and has **no year parameter** - deliberately,
since it owns "what colour means" for the 2024 composite. Neither spec §6 nor the plan
says how the slider survives the switch from `suhii` to `lst_rel`.
**Decision:** the back-cast composes on top of the encoding rather than inside it:
`v = encodeValue(props, refs); display = v == null ? null : v - (2024 - year)/10 * (sen_slope ?? 0)`.
`encodeValue` is not modified - its contract stays the 2024 value, which keeps spec §10.1's
promise that a Gi* swap touches only its body. Null must propagate, so the `case` guard
from Review Focus 1 wraps the composed value, not the raw one. Pinned by tests at year
2024 (identity) and year 2015 (full slope applied), plus a null case.
*Cost if wrong:* the year slider silently does nothing - the control moves, the map never
changes, and no test would have caught it.

## Task 7 pre-flight — three more findings

**Ruling 13 - city circles and labels stay DOM overlays; MapLibre cannot draw them.**
The original's city circles are `L.circleMarker` with `fill:false, color, weight:1,
opacity:.5, dashArray:'4 3'` - **unfilled, half-opacity, dashed** outlines, two nested
rings per city (cold then hot, sorted largest first, `radius: max(2.5, r)`), with the
label offset by the largest radius + 4 (prototype lines 752-776). The plan said "City
circles become a MapLibre circle layer with the original's `popScale()`".

MapLibre's `circle` layer has **no dash property** - `line-dasharray` exists only on line
layers - so a circle layer cannot reproduce a dashed ring. Its `symbol` layer likewise
has `text-halo-*` rather than the `.citylabel` rule's doubled
`text-shadow: 0 0 3px var(--color-bg), 0 0 3px var(--color-bg)`.
**Decision:** render both as DOM overlays positioned with `map.project()` on move and
zoom. The original already does this for labels (`L.divIcon` is a div), and a dashed ring
is exactly `border: 1px dashed` on a `border-radius: 50%` element, so the CSS transfers
verbatim. 55 cities x 2 rings + 55 labels is ~165 nodes, trivial to reposition.
*Cost if wrong:* solid rings instead of dashed, and a different label halo - both
flagged by the fidelity guard, but only after the work was done the wrong way.

**Ruling 14 - §9.1 bug 10 conflicts with §3, and §9 wins. It is a sanctioned VISIBLE change.**
Leaflet pane z-order in the original: `phys` 250, `bounds` 400, **`cityPane` 410**,
`dayPane` 420, `nightPane` 421, `labelPane` 470. So city circles render **below** the
spot polygons, while the handoff docs specify 460 - which is §9.1 bug 10.

Fixing it changes what the screen looks like, and spec §3 says only the four changes in
its table may do that. But §3's own wording is "a change that is not in the second table
**and not in §9** is out of scope", so §9 fixes are sanctioned by the fidelity rule
rather than exceptions to it.
**Decision:** fix it - city circles move above `dayPane`/`nightPane` and stay below
`labelPane`. The docs specify it, and the code's own comment calls the circles an
annotation on the polygons ("outline only - the spot polygons are the subject, these
annotate them"), which an annotation rendered underneath cannot be.
*Cost if wrong:* a visible departure from the approved page that the user did not ask
for. Flagged here for override; it is one line of layer order to revert.

**Ruling 15 - five §9 fixes change pixels and must be registered in ALLOWED_DIFFS.**
The plan describes Task 3's `ALLOWED_DIFFS` as "drawn from spec §3's Changed table". That
is incomplete: §9.1 bugs **4** (population bar divided by the magic 230), **5** (KPI share
bar `min(50, pct*6)`), **6** (unclipped state graticule), **7** (typology tile with no
`.val`) and **10** (ruling 14) all alter rendered output. Left unregistered, each would
surface as a fidelity-guard failure and look like drift rather than an approved fix.
**Decision:** `ALLOWED_DIFFS` entries are required for all five, each citing its §9.1 bug
number, and Task 3 seeds the five entries up front rather than letting later tasks
discover them. An entry with no spec citation is a defect.
*Cost if wrong:* the guard cries wolf five times, and the habit of adding entries to
silence it is exactly how a fidelity guard stops meaning anything.

### Task 2 — Vite + React + TypeScript scaffold and app shell

Three dispatch failures before work began to stick, none caused by the task:
1. Interrupted when the session ended; verified nothing had been written.
2. ENOTFOUND immediately after reading the brief; verified nothing had been written.
3. ENOTFOUND **mid-install**, after substantial work reached disk.

After failure 3 the repository was left in a genuinely broken intermediate state, which
is worth recording because it is the first time that has happened: the 14 runtime packages
installed and pinned, but no dev tooling, so `vite.config.ts` imported a missing
`@vitejs/plugin-react` and `npm test` stopped starting at all - the 87-test suite went
from green to not loading. Nothing was committed, so the work was recoverable, and
resuming the same agent was far cheaper than restarting: it had written the files and
still held the context.

**Ruling 16 - React 19.3.1 is accepted over the plan's React 18.**
The plan's Tech Stack said React 18; the implementer installed 19.3.1 before dying.
**Decision:** keep 19.3.1. It is the current major, the installed Radix versions support
it, and nothing in the fidelity rule depends on React's major version - the guard compares
computed boxes and tokens, which React's version cannot affect. Downgrading would cost a
reinstall and buy nothing. Plan and spec updated to say 19.
*Cost if wrong:* a Radix or Testing Library incompatibility surfacing later, which would
show up as failing component tests in this same task rather than silently.

**Ruling 17 - pin the four pre-existing caret ranges.**
`topojson-client`, `topojson-server`, `topojson-simplify` and `vitest` were still on `^`
from plan 1. The plan's Global Constraints say to pin every dependency exactly.
**Decision:** pin them to the installed versions as part of this task, since it is already
editing `package.json`. Pre-existing, so not a Task 2 defect - but leaving them would mean
the constraint is stated and not met.
*Cost if wrong:* none; pinning to what is installed changes nothing at runtime.

- Finished **inline by the controller** after a fourth ENOTFOUND, rather than a fifth dispatch.
  Attempt 3 had installed the 14 runtime packages but died before the dev tooling, leaving
  `vite.config.ts` importing a missing `@vitejs/plugin-react` - the 87-test suite stopped
  loading rather than failing. Remaining work was mechanical and fully specified, so another
  cold dispatch bought nothing.
- Commit: `3af4475`. Controller-verified: **104 tests / 10 files green**, `npm run audit`
  exit 0 at 80 pairs, `npm run build` emits 85 KB gzipped JS + 5.5 KB gzipped CSS.
- Guards proven by mutation and reverted with md5 verification: removing the rail/stage hide
  failed the ruling-5 test **alone**; dropping `persist.ts`'s write `try/catch` failed the
  throwing-write test **alone**.

**Ruling 18 - `@vitejs/plugin-react` pinned to 5.2.0, not latest.**
`@vitejs/plugin-react@6.x` peers on `vite@^8`, while `vitest@3.2.7` peers on
`vite@^5 || ^6 || ^7`. Installing both latest is an unsatisfiable ERESOLVE.
**Decision:** `vite@7.3.7` with `@vitejs/plugin-react@5.2.0` (peers `^4.2 || ^5 || ^6 || ^7`).
Revisit only when vitest supports Vite 8; do not reach for `--legacy-peer-deps`, which would
hide the conflict rather than resolve it.
*Cost if wrong:* a Vite major behind, with no feature this project uses on either side.

**Ruling 19 - the two dev-only advisories stay, and are not force-fixed mid-plan.**
`npm audit` reports `tinypool` (critical) and `@vitest/mocker` (moderate), both reached only
through vitest. `npm audit --omit=dev` reports **0**, so nothing reaches the deployed
dashboard. The offered fix is `--force` to vitest 4, a breaking major.
**Decision:** leave them; re-check in Task 12, where the dependency surface is final and a
suite revalidation is in scope anyway. Recorded rather than silently accepted - a critical
rating with zero production exposure is still a thing the user may want to know.
*Cost if wrong:* a dev-tool vulnerability in a local test runner; no deployed exposure.

**Observation (not a ruling) - the suite takes ~252s cold, ~6s warm.**
Vite dependency optimisation plus jsdom environment setup, per the vitest timing breakdown
(environment 333s, prepare 157s, collect 141s across workers). CI runs cold every time, so
this is already a ~4-minute step with only two component suites in the tree. Ten more tasks
of component tests will make it worse. Not blocking Task 2; flagged for Task 3, which adds
Playwright, and for Task 12. Likely levers: `pool: 'threads'` with a jsdom-only project split,
or caching `node_modules/.vite` in CI.

**Controller correction during Task 2.** I wrote a 9-test `ThemeProvider.test.tsx`, then the
mutation run's own output revealed `App.test.tsx` already covered five of those cases,
including both sides of the ruling-7 latch. Cut to the three real gaps: the attribute flip,
the deliberate no-write-on-mount, and a throwing WRITE as distinct from a throwing read. The
lesson is cheap but worth keeping - I should read the task's tests before adding to them.

## Task 10 pre-flight

**Ruling 20 - the Reports brief's 23px figures were missing from the §5.2 inventory, and
they are the sharpest case of ruling 8 yet.**
`renderReport` (prototype lines 1134-1145) draws a four-column figure grid inside `.brief`
at **`font-size: 23px`** with `--font-heading-weight`, on `--ui-panel-2`, coloured
`--hot-4`, `--cold-4`, `--hot-5` and inherit. Spec §5.2's corrected inventory did not list
it.

23px is **one pixel below** WCAG's 24px any-weight threshold, so the weight decides
everything, and the two themes land on opposite sides:

| Figure | Nocturne (500, so body text, 4.5) | Modernist (800, so large text, 3.0) |
| --- | --- | --- |
| `--hot-4` | 4.25 **fail** | 4.09 pass |
| `--cold-4` | 2.49 **fail** | 5.74 pass |
| `--hot-5` | 2.75 **fail** | 7.09 pass |

**All three fail in Nocturne and all three pass in Modernist**, from identical markup. One
pixel of font size and a weight token separate a compliant panel from a non-compliant one.
**Decision:** add the row to spec §5.2. **No change to the ink scale** - it clears 4.5 on
`--ui-panel-2` in both themes, so these were already fixed before I knew they were broken.
That is now the third time the derived scale has absorbed an error in my own inventory
(rulings 8, and twice within this one), and it retires any residual argument for
per-usage patching.
*Cost if wrong:* none to the implementation; the spec's inventory would stay incomplete.

**Task 10 note - the six export options are fixed copy, not invented.**
Spec §7.7 replaces six `.card2` export cards with one select plus a Download button. The
options must carry the original's six labels and descriptions verbatim (prototype lines
1157-1163):
`City brief (PDF)` / One page per selected city. · `Full report (PDF)` / All 55 cities with
national summary. · `Spot records (CSV)` / 441 rows · 30 fields. · `Contours (GeoJSON)` /
EPSG:4326, current view. · `Contours (TopoJSON)` / Compact geometry for the web. ·
`City aggregates (CSV)` / 55 rows.
The cards also carry an inline `padding: var(--space-4) var(--space-6)` overriding
`.card2`'s own `var(--space-6)`. The brief's prose paragraph interpolates `c.sig`,
`c.city_area` and `CLUSTERS[...].n_cities - 1`, so those fields must survive into the
rebuild's data layer.

### Task 2 review — performed by the controller

The dispatched reviewer died on ENOTFOUND **at its write step** ("Now writing the review"),
the fifth network failure on this task, and left no file. Rather than a sixth dispatch I
reviewed it myself, noting in the review that I also finished the implementation - a weaker
arrangement than independent review, recorded rather than glossed. Full review:
`task-2-review.md`.

**Both verdicts PASS**, after one high-severity defect found and fixed.

**Finding 1 (HIGH, fixed) - the ruling-7 effect double-fired under StrictMode.**
`src/main.tsx` wraps `#root` in `<StrictMode>`, but every test rendered a bare `<App />`, so
the double invocation production has never ran in test. A throwaway probe proved it:
boot produced `["dark","dark"]`, and a theme change `["dark","dark","topo"]`, while the suite
asserted `['dark']` and passed. Against Task 2's no-op stub that is harmless; against Task 6's
real `setBase` it is a **double tile-source swap on every page load**.

The same code also assigned `pickedRef.current` **during render** to keep the latch out of the
dependency array - a render-phase side effect, unsupported under concurrent rendering where a
discarded render still mutates the ref.

Fixed by changing the guard from "is the latch set" to "have we already applied this key"
(`lastApplied`). That makes `userPickedBase` safe as a real dependency: the latch flipping true
re-runs the effect, which returns early, so the flip still never moves the basemap - ruling 7
unchanged. All three component suites now render inside `<StrictMode>`, matching production.
Mutation-proven: removing the guard fails the ruling-7 test alone (1 failed / 10 passed),
restored to md5 `1cb9083f864a35b4d3dd0c1b2aa62a20`.

This is the most useful finding of the project so far, and it was only findable by running the
code rather than reading it. **Carried forward as a standing rule: a component test renders the
tree the way `main.tsx` renders it, inside StrictMode.** Any later task whose tests mount
components bare is reproducing this bug class.

**Finding 2 (LOW, fixed) - `data-framed` was scope creep.** An attribute the original lacks,
styled by nothing, existing only to be asserted; its test was checking our invention rather
than the original's behaviour. Removed; the test now asserts the `.framed` class that
`.stage.framed` actually keys on.

**Ruling 21 - the fidelity guard must ignore generated `id` attributes.**
Radix renders `id="radix-_r_0_-trigger-map"` and similar on the tab triggers. The original's
tabs carry no `id`; nothing styles these and they do not affect computed boxes, but they are
generated, unstable between runs, and now serve nothing because `aria-controls` was
deliberately cleared.
**Decision:** accept them, and constrain Task 3 - the guard compares computed box and computed
type per selector and must **not** compare `id` on `.tab`, or it fails on a value that changes
every run. Removing them would mean fighting Radix for no visual gain.
*Cost if wrong:* a guard that fails randomly, which is a guard people switch off.

**Finding 4 (LOW, accepted) - `ThemeProvider` suppresses its boot write with `paintEpoch > 0`
while `I18nProvider` uses a separate `dirty` boolean** (costing an extra render on first
change). Both correct, both pinned. Not unified mid-plan; recorded so a later reader does not
read one as a mistake.

**Task 2: complete.** 104 tests / 10 files green, audit exit 0 at 80 pairs, build 85.37 KB
gzipped, `npm audit --omit=dev` 0, no later-task library wired, `project/ data/ scripts/
src/lib/ src/i18n/` untouched.

### Task 3 — the fidelity guard

Built inline by the controller (the sixth dispatch attempt would have been the sixth network
failure). Commits `87b5ff5` and `325d3ca`. 104 unit tests, 6 fidelity tests, audit exit 0,
~20 s for the fidelity run. Full detail in the commit messages.

**Ruling 22 - `.claude/launch.json` serves the wrong root, and the prototype cannot load data
under it.** It runs `python -m http.server --directory project`, but the prototype fetches
`../data/cities.json` (lines 593-595), which escapes that root and 404s. So the dev-server
config in the repo has never been able to render the prototype with data. `tests/fidelity/server.mjs`
roots at the repository instead, which is the only root serving both `/project/...` and `/data/`.
*Decision:* leave `launch.json` alone for now - nothing in the plan depends on it - and fix it in
Task 12 alongside the deployment config. Recorded so nobody debugs the 404 twice.

**Ruling 23 - the search does NOT fold diacritics, and the plan's test for it is wrong.**
Plan Task 4 specified `test('matches a city name with diacritics typed without them')`. The
original filters with `c.city.toLowerCase().includes(q)` (line 999) - no normalisation - and
**all 55 city names in `data/cities.json` are pure ASCII**, so the test is both unfaithful and
untestable against this data. Folding would be an improvement, not a transcription.
*Decision:* drop that test. Reproduce `toLowerCase().includes()`, the `slice(0, 6)` cap and the
em-dash empty state exactly. Diacritics still matter for the four-language dictionary, which has
its own fixture - a different concern that this test was conflating.
*Cost if wrong:* a Hausa or Yoruba place name added later would not be findable without its
marks. Worth offering the user as a deliberate improvement; not smuggled in as fidelity.

**Ruling 24 - the mechanism of §9.1 bug 2, for whoever fixes it.**
`buildRail()` emits `data-on="true"` on every layer toggle unconditionally (line 962), and is
**re-called on every language change** (line 1015). So switching language silently resets all six
toggles' visuals while `state.layers` keeps the real values - the desync is not a one-off render
bug but a rebuild that discards state. The React version must derive `data-on` from state, which
also makes Review Focus 3's test meaningful rather than incidental.

**Ruling 25 - the basemap keeps its five Esri options. §8.3's PMTiles swap is NOT sanctioned by §3.**
A conflict between my own spec sections. §8.3 ("the basemap joins the design system") argues for
replacing Esri with a self-hosted Protomaps basemap styled from our tokens. But §3's Changed
table - the binding list of permitted visual departures - does not include the basemap, and a
basemap is about as visual as a map gets. `BASES` (lines 579-590) defines five Esri layers, and
`renderBaseSeg` renders a button per entry labelled with the second word of each label
(Dark / Topo / Relief / Gray / Imagery) at an inline `font-size:10.5px`.
*Decision:* reproduce all five. The engine swap in §8.2 does not require the basemap swap -
MapLibre consumes Esri raster tiles through a raster source perfectly well - so Task 6 can be
faithful and still drop Leaflet. PMTiles becomes a later, additive option.
**This is flagged for the user rather than settled:** replacing five familiar basemaps with one
styled vector basemap is a real improvement and was in the original brainstorm, but it is a
visible change to the approved design and that is the user's call, not mine.
*Cost if wrong:* we keep a third-party tile dependency §8.3 wanted gone, and defer work that is
additive rather than blocking.

**Ruling 25 REVERSED by the user, 2026-10-23: the vector basemap is approved.**
I ruled to keep the five Esri raster basemaps because §3's Changed table does not list a basemap
change. The user overrode it: *"go with the vector basemap"*. So spec §8.3 is reinstated -
a self-hosted PMTiles/Protomaps basemap styled from the theme tokens, flipping with
`data-theme` like everything else, and the Esri dependency goes.

Consequences to carry:
- **Task 6 owns it.** The basemap becomes a MapLibre vector source with a style built from
  `THEME_TOKENS`, not a raster tile layer.
- **Task 4's basemap segment is affected.** `BASES` has five Esri entries and
  `renderBaseSeg` labels each from the second word of its label. With one vector basemap the
  segment's options change. Task 4 is mid-flight building the five; **it finishes as specified**
  and Task 6 revises the segment, because changing the brief under a running implementer costs
  more than one later edit.
- **`ALLOWED_DIFFS` needs an entry** citing §8.3 - the basemap is a visible departure from the
  approved page and the guard will see it. This is the first entry whose citation is a §8
  section rather than §3 or §9.1, which is correct: the user authorised it.
- **Ruling 7's latch survives.** A theme change still moves the basemap until the reader picks
  one; with a single vector basemap the "pick" becomes the style variant rather than a provider.

**Process correction, raised by the user, 2026-10-23.** The user pointed out that four tasks in,
they had still never seen the application running - only the original HTML. That is a fair and
accurate criticism of how I have been working. I verified Tasks 1-3 with md5s, computed-box
comparisons, contrast ratios and mutation tests, all of which are real evidence, and never once
rendered the thing and looked at it. A fidelity guard that compares computed boxes cannot tell
you whether the result looks right to a person, and it cannot be shown to a stakeholder.

Corrected now: `.claude/launch.json` rewritten with working configs for both the rebuild
(`npm run dev`, port 5180) and the original (the repo-rooted server from ruling 22, port 5179),
and screenshots of both captured and sent to the user.

**Standing rule from here: every task that changes something visible ends with a screenshot of
the running app sent to the user, not just a green suite.** Put it in each remaining dispatch.

### Task 4 — rail groups 1-5

Commit `2cdc892` (implementer) + the ruling below. Controller-verified: 129 tests / 14 files,
audit 80/80 exit 0, build clean, **fidelity 6/6 green**.

**Ruling 26 - `.kpis` gets a box exemption citing §9.1 bug 7. The implementer was right to refuse
to silence it.**
It reported DONE_WITH_CONCERNS with one difference per theme and added nothing:
`.kpis height: 325.67 vs 351.67` (Nocturne, +26.00) and `387.66 vs 397.39` (Modernist, +9.73).
I re-ran it and confirmed that is the only difference in either theme.

The cause is mechanical and the implementer diagnosed it correctly: bug 7 gives the sixth tile a
`.val`, which is a 24px line box plus the sub's inline 2px top margin; Modernist nets less
because the shortened `.sub` reflows from two lines to one and recovers 16.27px. **A figure line
cannot be added without its container growing by it.** The existing bug-7 entry exempts
`.kpi.wide:last-of-type .val` with `property: 'exists'`, which covers the element appearing but
not the grid's height, so my dispatch's claim that this task "needs no new ALLOWED_DIFFS entry"
was simply wrong.
*Decision:* add `{ target: '.kpis', property: 'box', cite: 'spec §9.1 bug 7' }` with the measured
numbers in its `why`. This is the sanctioned fix's own geometry, not a new departure - exempting
the `.val` and not its container would have made bug 7 unshippable.
*Cost if wrong:* a real regression in the KPI grid's height would now pass. Narrow: the tiles
themselves are still compared, so only the grid's total height is unguarded.

**The implementer deleted a 17th PENDING line, `.bar`, tagged task 5 - accepted.** The first
`.bar` in the document is the KPI share bar, which Task 4 renders, so the anti-rot clause fired
correctly. Deleting it makes the guard *compare* `.bar` (it passes clean in both themes) instead
of skipping it, which is strictly more coverage, and the guard's own failure message instructs
the task that makes a selector exist to delete its line. Verified nothing in groups 6-10 renders
a `.bar` before the drawer's, which is Task 7's and sits below this one in document order.

**"Every figure renders an em dash" was my overstatement, correctly narrowed.** With Lagos +
cluster 1 (genuinely 0 of 441, asserted) only `d3.mean([])` is indeterminate: `[].length` and
`d3.sum([])` are `0`, and `cityArea` is a real 1,465 km2. The faithful output is
`0 / 0 / 0.00% hot · 0.00% cold / 0 / 0 / — °C`, which is what the test asserts, plus all six
bar widths at `0%` and no `NaN`/`Infinity`/`undefined`/`null` anywhere in `#rail`.

**Carried forward:** `src/types/d3.d.ts` declares only the three d3 members in use rather than
pulling `@types/d3`, because d3 formats negatives with U+2212 where `toFixed` and `Intl` do not,
and the typology mean goes negative once the year slider back-casts. **Later tasks extend that
file; they do not widen it to `@types/d3`.** Data is fetched from the prototype's own
`../data/*.json` against `document.baseURI` rather than bundled, which is why no polygon geometry
reaches the 319 kB chunk.

**User feedback, 2026-10-23: commit messages read as robotic.** *"hope you're commiting to git and
with a message that is not AI'sh or robotic sounding."* They had drifted into status-report
shape - stacked bullets, a heading per concern, measurements quoted for their own sake. From here
they are a subject line plus a paragraph or two of plain prose; the rulings and the numbers live
in this ledger, which is where a future reader should look for them anyway. Saved as a durable
preference in project memory (`commit-message-voice`), along with the fidelity-rebuild framing
and the show-the-running-app rule.

## Task 6 pre-flight — the vector basemap has an asset problem the spec glosses over

**Ruling 27 - the basemap asset is sourced separately from Task 6's code, and the hosting needs
the user's decision.**

Spec §8.3 says "a self-hosted Protomaps basemap... we serve our own file", and §8.6 says
"Cloudflare Pages, static". Those two do not fit together, and nothing in the repo closes the gap:

- **There is no `.pmtiles` file anywhere** (`find . -name "*.pmtiles"` outside node_modules returns
  nothing). It has to be built from an OSM extract.
- **The `pmtiles` npm package is a reader, not a builder.** `npx pmtiles` fails - "could not
  determine executable to run". Cutting a regional extract needs the Go CLI
  (`go-pmtiles`), which is a separate binary download.
- **Cloudflare Pages caps a single file at 25 MiB.** A Nigeria vector basemap covering the
  dashboard's zoom range (the map goes to maxZoom 16) is comfortably past that. So "static upload"
  and "self-hosted basemap" are in direct tension - §8.3 and §8.6 were both carried over from
  revision 1 and never checked against each other.

Three ways out, and the choice is the user's because it is about infrastructure and cost rather
than code:

**A. Cloudflare R2 plus a small Worker** - the standard Protomaps serverless deployment. R2's free
tier covers this comfortably. Correct and unconstrained, but it stops being a pure static site and
adds an account resource to manage.

**B. Trim the extract to fit** - Nigeria only, a reduced zoom ceiling, and only the layers the
design actually draws (water, roads, boundaries, landuse, places). Keeps deployment to a single
static upload, matching §8.6. The cost is basemap detail at high zoom - though by z13 the contour
polygons are the subject and the basemap is backdrop.

**C. Protomaps' hosted API** - rejected: §8.3's stated reasons include removing a third-party
dependency and needing no key, and this reintroduces both.

*Decision for now:* pursue **B**, fall back to **A** if the trimmed file will not fit, and have
Task 6 read the basemap URL from **one place** so swapping between them is a one-line change. The
style JSON, the token mapping and all the spot layers - the great majority of Task 6 - do not
depend on which we pick, so this does not block the task.
*Cost if wrong:* a basemap that is thin at high zoom (B) or a deployment with a moving part (A).
Neither is expensive to reverse, which is why the URL is isolated.

**Flagged to the user**, because A costs them a Cloudflare resource and B costs visible detail.
