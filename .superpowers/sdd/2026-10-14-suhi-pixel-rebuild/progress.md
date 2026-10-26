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

### Task 5 — rail groups 6-10

Commit `f7f08ca`. Controller-verified: 152 tests / 17 files, audit 80/80 exit 0, build clean,
**fidelity 6/6 on the implementer's first run with zero differences in either theme and no new
ALLOWED_DIFFS entry**. All nine `task: 5` PENDING lines deleted. Screenshots delivered to the
user. The rail is now complete: 10 of 10 groups.

**Ruling 28 - native `<input type="range">` and native `<select>` stand, against the brief.**
The brief's Step 3 said to use Radix `Slider` for `#opacity` and `#year` and Radix `Select` for
`#cluster`. The implementer reversed both and asked for a ruling instead of quietly deviating.

It is right, and the reason is specific to this project: **`input[type=range]` is one of the
guard's measured selectors.** A Radix Slider renders spans, so the element would disappear from the
rebuild and the guard would fail outright - and the only way to make it pass would be to re-add the
PENDING line, which is silencing. The styling is also pure user-agent chrome (`accent-color`, the
select's own arrow), and a native range input already carries `role="slider"`, is a tab stop and is
arrow-operable, so there is no accessibility gap for Radix to close. Same precedent as Task 2's
header pickers.
*Decision:* approved. Documented at both call sites and pinned by a test.
*Cost if wrong:* none identified - Radix would add markup the CSS does not target and remove an
element the guard measures.

**Observation - the guard measures only the FIRST match of a selector.** The implementer flagged
that `#cluster` is the *second* `.search` in the document, so a regression in the cluster select
would not be caught. The same is true anywhere a selector repeats. Not a defect in this task;
a real limitation of `capture()`. **For Task 12:** either compare every match or give repeated
selectors a positional form (`.rail > div:nth-of-type(7) .search`). Recorded rather than fixed now
because changing the capture shape mid-plan would churn every task's baseline.

**Accepted judgement calls:** `, °C` appended to the §6.3 legend labels, since the spec supplies
the phrase but not the unit and the original's label is where the unit lived; and Task 4's `.cbar`
test scoped to `#conf`, because the cluster card renders five more `.cbar` rows (the guard was
unaffected - `#conf` precedes `#clusterCard`).

**Carried forward:**
- *Task 6:* the legend's ramp ticks are still `suhii` quantiles. §6.2's ±4.5 domain has to come
  from `encodeValue`, and `HOT_TICKS` / `COLD_TICKS` are exported so that changes in one place.
- *Tasks 7 and 8:* `.card2` and `.dl2` **already exist in the rail** behind a non-default cluster
  selection. Deleting their PENDING lines will make the guard measure *that* element, not the
  drawer or the compare card. Use a scoped selector.
- `.ly .key` had a CSS rule but no element in the original, so it was a check that could never
  fire; deleted with the rest.

## Basemap extract — measured, and option B does not hold up

Cut with `go-pmtiles` v1.31.2 (user-approved download) from `build.protomaps.com/20261020.pmtiles`,
bbox `2.5,3.9,15.0,14.1`:

| Zoom ceiling | Size | Against the 25 MiB Pages cap |
| --- | --- | --- |
| z0-12 | **163.08 MB** | 6.5x over |
| z0-10 | **39.23 MB** | 1.6x over |
| z0-9 | ~10 MB (extrapolated; the top level is roughly three quarters of each total) | fits |

**My earlier estimate was wrong.** I told the user B would fit "a zoom ceiling near 12". It does
not - z12 is 163 MB, and even z10 is over. The only ceiling that fits a static upload is **z9**,
which is seven levels below the map's `maxZoom: 16`.

Vector tiles upscale without blurring, so z9 under a z16 view stays crisp - but the data simply
is not there: at z9 Nigeria has major roads, water and place points, and nothing finer. The
dashboard's purpose is a ministry or field officer zooming into *their* city, and that view would
have almost no basemap under it.

Two things I could not use as levers: `pmtiles extract` cannot filter layers (dropping buildings,
transit and POIs would need re-encoding every tile through tippecanoe, far heavier tooling), and
a local extract cannot be re-cut because its output is not clustered - every ceiling costs another
fetch from source.

**So the recommendation flips to A** (Cloudflare R2 plus a small Worker), and the user has to make
that call because it is their infrastructure. Put to them with the measurements.

`*.pmtiles` is gitignored - 39 MB has no business in this repo, and the file is reproducible from
one command, which is recorded in the spec.

**Ruling 29 - the basemap goes to Cloudflare R2 with a Worker. The user chose A over my earlier B.**
My ruling 27 picked B (a trimmed static extract) on an estimate that turned out to be wrong by a
factor of six. With the measurements in hand - z12 at 163 MB, z10 at 39 MB, only z9 under the cap -
the user chose A, and that is the right answer: a z9 basemap under a z16 map would be empty exactly
where §1's audience looks hardest.

*Consequences for Task 6:* the basemap URL is configuration, not code, and sits in one place.
Development reads `public/nigeria-z10.pmtiles` (already cut, 39 MB, gitignored); production reads
the R2 URL. Nothing else in Task 6 depends on which. The `ALLOWED_DIFFS` entry citing §8.3 is still
required - the basemap is a sanctioned visible departure, authorised by the user rather than by §3.

*Deferred to Task 12:* cutting the production extract, the R2 bucket, the Worker, and the
`Content-Type` plus range-request requirements. Not now - a multi-gigabyte fetch buys nothing until
the map renders.

## Task 6 pre-flight, second pass — initMap

**Ruling 30 - Nigeria's bounds become a documented constant and the world-atlas CDN fetch goes.**
`initMap` draws the national outline from `NG`, the Nigeria feature plucked out of
world-atlas@2.0.2 (line 599), and both `fitNation()` and the state graticule's extent derive from
`d3.geoBounds(NG)` (lines 623, 650). That is a 110 KB CDN download whose only products are an
outline and a bounding box.

With the vector basemap approved, the outline can come from the basemap's own `boundaries` layer
styled to `--ui-line-strong` at 2px, and the bounding box is a constant we already know - it is the
bbox the extract was cut with, `2.5,3.9,15.0,14.1`.
*Decision:* hardcode the bounds as a named constant with a comment saying where it came from, style
the boundary from the basemap, and drop the world-atlas fetch. This finishes what §8.3 started -
the Esri tiles were one third-party dependency, this was the other - and it removes the failure
mode the Task 3 guard had to stub around, where a dropped atlas request left the prototype rendering
zero KPIs behind a removed loading overlay.
*Cost if wrong:* a hand-entered bound could be subtly wrong. Cheap to check: `fitNation()` framing
is visible, and the guard measures `.mapwrap`.

**Ruling 31 - the "state boundaries" layer could stop being a placeholder, but that is the user's
call and not Task 6's to take.**
The layer labelled *State boundaries* with the chip *placeholder* is a `d3.geoGraticule` at
1.6-degree steps - a grid, not boundaries - and §9.1 bug 6 is that its extent is unclipped, so the
grid runs over Niger, Cameroon and the sea. §10.2 lists real state boundaries as blocked, needing
GRID3 or GADM.

The Protomaps basemap carries real administrative boundaries, so that blocker is now partly lifted.
*Decision for Task 6:* fix bug 6 as specified - clip the graticule to Nigeria - and **do not**
substitute real boundaries. Swapping a grid for actual state lines changes what the layer means and
makes its own chip wrong; it is an improvement to offer, not a transcription.
**Flagged to the user:** the basemap we are adding can give that layer real state boundaries and
retire the placeholder chip. Worth doing, worth asking first.

Also carried into the dispatch: initial view `setView([9.1, 8.7], 5.6)` is immediately overridden by
`fitNation()`; `minZoom: 5`, `maxZoom: 16`; `zoomend` drives both the exaggeration bucket and the
zoom hint; and the `setInterval` container-sizing hack (lines 639-645) exists because Leaflet needs a
sized container - MapLibre does not, so it goes, and the tab-change resize is handled by the
mounted-but-hidden rule from ruling 5.

## Task 7 pre-flight — the drawer

**Ruling 32 - `.pill` is a fourth ramp-as-text usage my §5.2 inventory missed.**
`openSpot` renders `<div class="pill" style="color:${spotFill(p)}">` (line 880), and `.pill` is
`font-size: 9.5px` with `border: var(--ui-rule) solid currentColor` (line 202) - so the
interpolated ramp colour is both the text and the border, on `--color-bg`, at 9.5px, floor 4.5.
Nocturne `--cold-5` sits at 1.75 against that ground; a severe night cold spot's pill would be
very nearly invisible.

That is the **third** time (rulings 8, 20, now 32) that hand-enumerating usages missed one, and the
third time the derived ink scale had already covered it - every ink token clears 4.5 on all three
grounds in both themes, so `.pill` was fixed before I knew it was broken. I am going to stop
treating the §5.2 inventory as complete and start treating the scale as the guarantee, which is
what §5.5 argued in the first place.
*Decision:* add `.pill` to §5.2, use the ink scale for its colour, and note that `currentColor`
makes the border inherit the fix for free.
*Cost if wrong:* none to the implementation.

**Also carried into Task 7's dispatch:**
- `.dl2` appears four times in the drawer, and Task 5 flagged that `.dl2` **already exists in the
  rail** behind a non-default cluster selection. The guard measures the first match, so Task 7 must
  use a scoped selector (`.drawer .dl2`) or it will silently measure the rail's.
- The `bh_significant` row colours with `--hot-4` as text at 12px - another fill token used as
  ink; it passes at 5.29 but should still take `--hot-4-ink` under the fill/ink rule.
- Two inline handlers, `onclick="closeDrawer()"` and
  `onclick="focusCity('${p.city.replace(/'/g,"\'")}')"`, hand-escape a quote into generated HTML.
  No city in the data contains an apostrophe (all 55 names are ASCII), so it never fires - but React
  handlers remove the whole class of bug, and that is worth stating rather than silently fixing.

**Ruling 31 REVERSED by the user, 2026-10-24: use real state boundaries.**
I ruled to keep the 1.6-degree graticule and merely clip it, on the grounds that swapping a grid
for real administrative lines changes what the layer means. The user decided it should mean that:
*"use real"*.

So the layer now draws Nigeria's first-level admin boundaries from the Protomaps basemap's own
boundaries source, keeping the original's treatment - `--ui-muted`, 1px, `opacity .5`, dashed
`3 4` - and staying visually subordinate to the 2px `--ui-line-strong` national outline from
ruling 30. The `d3.geoGraticule` goes entirely.

Three consequences, all sent to the Task 6 implementer mid-flight rather than deferred, because it
is authoring the style JSON right now and reopening it later would cost more than a precise
message does:
- **§9.1 bug 6 is now fixed by deletion, not clipping.** There is no graticule left to clip. Its
  `ALLOWED_DIFFS` entry stays - the output still departs from the original - but its citation
  gains `spec §8.3`, since the basemap is what made the fix possible, and its `why` records the
  user's approval.
- **The rail chip was lying.** `buildRail`'s layer list shows `441` / `55` / `1` / `placeholder`;
  with real boundaries that last one is false. It becomes `37` - 36 states plus the FCT. The other
  chips are plain numbers rather than translated strings, so this needs **no dictionary change**
  and `src/i18n/` stays untouched.
- **§10.2's "state and national boundaries" backlog item is now partly closed.** It was blocked on
  sourcing GRID3 or GADM; the approved basemap supplies admin lines, so the blocker is gone for
  level 1. Whether the finer GRID3 data is still wanted is a separate question.

I also told it: if the basemap's boundaries layer turns out not to carry admin-level-1 lines for
Nigeria at the zooms we ship, report what it does contain rather than inventing a substitute.

**Note on the mid-flight change.** This contradicts the precedent I set at Task 4, where I let the
Esri segment finish as specified rather than rewrite a running implementer's brief. The difference
is where the work sits: Task 4's basemap segment was a separate component a later task could revise
cheaply, while this lives inside the style JSON Task 6 is authoring this minute. Judged per case,
not by the earlier precedent.

### Task 6 — the MapLibre map

Commit `8bb1d0d`. Controller-verified: 212 tests / 23 files, audit 80/80 exit 0, build clean,
**fidelity 6/6 with `#map`, `.ovl` and `.mapsub` deleted from CONTENT_PENDING and now actively
compared**. Both screenshots show a real map and were sent to the user.

**The screenshot rule paid for itself immediately.** MapLibre's worker failed to load in dev *and*
emitted no chunk in the production build - a template-literal specifier Rollup cannot analyse - so
**the map drew nothing while 212 tests, a clean build and a green fidelity guard all passed**.
Nothing in the automated stack could see it, because the guard measures the container's computed
box and the container was correct. The user asked for screenshots two tasks ago and this is exactly
the class of failure they catch. Fixed with `?worker&url` plus `setWorkerUrl`.

**My basemap extract was corrupt and I reported its size as fact.** `public/nigeria-z10.pmtiles` as
I left it had an all-zero header, no magic string anywhere, and 7.3% non-zero bytes - the file was
never a PMTiles archive. The cause is almost certainly that my `pmtiles extract` runs were
interrupted twice mid-write, leaving a correctly-sized sparse file. I then quoted "39.23 MB" into
spec §8.3's measured table as though it were a measurement. The implementer reimplemented the
extractor in Node and cut a valid archive - 1,522 tiles, 40,347,650 bytes, which is close enough to
confirm the size claim was right even though the file was not. **Verified independently: the header
now reads `PMTiles`.** The z12 figure of 163.08 MB came from an uninterrupted run and is probably
sound, but it is an extrapolation basis I would not lean on again without re-cutting.

**Ruling 33 - the state boundaries cannot be clipped to Nigeria, and the user has to see it.**
Admin level 1 is present (`kind: 'region'`, `kind_detail: 4`) but the features **carry no country
code, name or ISO field at any zoom**, so there is nothing to filter on. Niger's, Benin's,
Cameroon's and Chad's first-level divisions therefore render inside the bbox alongside Nigeria's,
and it is plainly visible in both screenshots. The implementer reported this rather than inventing a
clip, which is what I asked for.
Options: accept it (neighbours' admin lines in a dashed, half-opacity, muted treatment are arguably
just context); clip by geometry against Nigeria's own outline at render time (real work, and the
national outline comes from the same unlabelled source); or go back to GRID3/GADM for Nigeria-only
state lines, which is what §10.2 always said. **Put to the user.**

**Ruling 34 - `.seg button` gets a box exemption citing §8.3.** The basemap segment went from five
Esri providers to three vector variants, so each button is wider: 56.67 to 95.80 px in Nocturne,
53.59 to 90.66 px in Modernist, with the `.seg` container identical on both pages. That is the
direct geometry of a user-approved change. Accepted.

**Found by me, not reported: the basemap note is now false.** `basemap_note` still reads "Esri and
Carto tile services - free, no key required." in all four languages (`src/i18n/dictionary.mjs:30-33`).
We self-host Protomaps now; Esri and Carto are gone. The copy has to change in four languages, and
the Hausa, Igbo and Yoruba lines are a first pass already flagged as needing native review (§10.2),
so this is a translation question rather than a string edit. Assigned to Task 12 with the other copy
work; recorded here so it is not shipped as-is.

**Also noted:** the original boots at zoom 5 showing `×9`, not its fitted zoom, because its
`fitNation` runs before the container is measured and Leaflet clamps to `minZoom` - the implementer
transcribed that first frame faithfully and left `fitNation` correct, so `Fit` moves the map on
first press. No symbol layers and no `glyphs` endpoint, because a glyph CDN would undo rulings 29
and 30 and ruling 13 keeps labels in the DOM anyway. Bundle is now 1,400 kB JS plus a 506 kB worker,
up from 337 kB - that is maplibre-gl, and it matters for §1's phone and projector audience.

## Task 7 pre-flight — the swipe does not survive the engine change

**Ruling 35 - the day/night swipe becomes two synced MapLibre instances with the top one
CSS-clipped. Nothing else reproduces it.**
`positionSwipe` (lines 838-850) sets `clipPath: inset(...)` on Leaflet's `dayPane` and
`nightPane` - two separate DOM elements holding two separate SVG overlays, each independently
clippable. **MapLibre has no panes.** Every layer renders into one WebGL canvas, so there is no
element to clip that contains only the night spots.

What was considered and rejected:
- *Filter by longitude.* The swipe is a screen-space vertical line, which does correspond to a
  longitude for a given view - but it would have to be recomputed on every pan and zoom, and
  polygons straddling the line would pop in and out whole rather than being cut. The original cuts
  geometry mid-polygon; this does not.
- *Clip the single canvas.* Clips both periods identically. Pointless.
- *Split each period's GeoJSON at the line on every move.* Correct output, but a full re-tessellation
  of 441 polygons per frame, and `setData` on every pointermove is exactly the Leaflet problem §8.2
  exists to escape.

**Decision:** two MapLibre instances, bottom showing day, top showing night, the top one clipped
with CSS `clip-path` and both kept in sync on `move`/`zoom`/`rotate`. This is the established
compare pattern (what `mapbox-gl-compare` does), it reproduces the original's behaviour exactly
including mid-polygon cuts, and the clip stays a CSS property on a DOM element as it is today.

*The cost is real and worth stating:* two WebGL contexts and two basemap loads on a page whose
bundle is already 1,400 kB plus a 506 kB worker, for an audience §1 says is mostly on phones and
projectors. The basemap tiles are shared through the same PMTiles source and the browser cache, so
the second instance costs GPU and memory rather than bandwidth, but it is not free.
*Cost if wrong:* a heavy page on a mid-range phone. The fallback is to drop to one instance and
accept that the swipe reveals whole polygons rather than cutting them - a visible fidelity loss,
which is why it is the fallback and not the plan.
**Flag to the user if it measurably hurts on a phone; do not pre-emptively trade the fidelity away.**

**Also carried into the dispatch:**
- `showTip` clamps to `window.innerWidth - 256` and `window.innerHeight - 190` (line 854), magic
  numbers tied to `.tip{max-width:240px}` plus padding. Reproduce them; do not "fix" them to read
  the element.
- `spotTip`'s `<b style="color:${spotFill(p)}">` at 13px and `cityTip`'s `--hot-4` / `--cold-4`
  spans at 11.5px are **more ramp-as-text usages**, on `--ui-tip`. Ink tokens, per ruling 32 - and
  this is the fifth and sixth such usage I did not enumerate, which is the argument for treating the
  scale rather than the inventory as the guarantee.
- `cityTip` also colours the cluster line with `--color-accent` on `--ui-tip`: `--accent-ink`.
- `.dl2` is used by the drawer four times and already exists in the rail (Task 5's warning), so the
  guard needs `.drawer .dl2`. The tooltip's `dl` is a bare `dl` inside `.tip`, not `.dl2`.

## Task 8 pre-flight — the clustered bars have no data behind them

**Ruling 36 - the day/night split is derived by `derive.mjs` into a NEW file, and Task 8's scope
widens to cover it.**

Spec §7.5 and the plan both say each Compare measure "renders two bars, day and night" - the
clustered-bar chart the user asked for. **`data/cities.json` has no day/night split.** Its 25 fields
(`suhii`, `mean_lst`, `max_lst`, `pop_hot`, `area_hot`, `slope`, `hotdays`, …) are all aggregated
across both periods; the only field containing the word is `hotdays`. So no task in the plan
produces the data the chart needs, and Task 8 as written cannot be built.

It *is* derivable: `data/spots.geojson` carries `period` on every feature (225 day, 216 night; 90
and 95 at L50) alongside every measure the chart draws - `suhii`, `mean_lst`, `max_lst`,
`population`, `area_km2`, `sen_slope_C_per_decade`, `n_modis_hot_days`.

**Where it gets derived matters more than that it can be.** `scripts/lib/derive.mjs` is the single
owner of what the published figures are: it encodes the L50-only rule and ruling 18's
multiplicity-weighted means, and plan 1 verified its output field-by-field against the published
values. A second aggregation written client-side would drift from it, and the Compare tab would
quietly disagree with the Table about the same city.
*Decision:* extend `derive.mjs` to emit a **separate `data/cities-by-period.json`**, and widen
Task 8's scope to include that change. A separate file rather than new fields on `cities.json`,
because `derive.test.mjs` asserts the committed JSON reproduces **byte for byte** - adding fields
would break a guard that is doing exactly its job. The new file carries the same L50-only and
multiplicity rules, keyed `${city}|${period}`, and gets its own byte-for-byte test.
*Cost if wrong:* a second data file to keep in step. Mitigated by both coming out of one script and
one test run.

This is the first task whose scope I have widened rather than narrowed, and the first time a task
will touch `scripts/` since plan 1 merged - so the dispatch says so explicitly, and says that
`cities.json`, `clusters.json` and `spots.topo.json` must come out byte-identical.

## Task 11 pre-flight — both its features are out of scope by §3's own rule

**Ruling 37 - deep links (§8.4) and the print stylesheet (§8.5) are NEW FEATURES, not corrections,
and §3 excludes them. Put to the user rather than built or dropped on my judgement.**

§3's rule is explicit: *"A change that is not in the second table and not in §9 is out of scope."*
Neither feature is in either:
- **The original has zero URL state.** No `location`, `history`, `URLSearchParams`, `pushState` or
  hash handling anywhere in its 1,179 lines.
- **The original has zero print styles**, and - contrary to §8.5's claim that the build does this
  "despite planning to call `window.print()`" - **it never calls `window.print()` either**. That
  sentence is false for this prototype.

Both sections are revision-1 carry-overs I never re-checked, and both carry factual errors:
- §8.4's list of what to encode includes **"density"**, a control that revision 1 added to the
  header and that §11 records as *rejected*. The word appears nowhere else in the spec. It is
  encoding state for a control that does not exist.
- §8.5's premise about `window.print()` is simply wrong, as above.

So Task 11 - "Deep links and print" - is a task built entirely on two unsanctioned features
described by two stale sections. That is not a small drafting slip; it is most of a task.

**Both are genuinely valuable and I am not arguing against them.** Deep links are what make a
screenshot in a ministry memo reproducible, which speaks directly to §1's audience. The Reports tab
produces a one-page brief "for circulation" that currently prints badly. But adding features is a
different decision from rebuilding faithfully, and the user has been clear which project this is.
*Decision:* ask. If yes, §8.4 and §8.5 are rewritten to drop the density reference and the false
`window.print()` premise, and both become sanctioned additions like the vector basemap - needing
`ALLOWED_DIFFS` entries only where they change rendered output, which deep links do not and print
styles do not either, since `@media print` never affects the screen.

**Ruling 37 resolved: the user approved BOTH on 2026-10-26.** §8.4 and §8.5 are rewritten - the
density reference removed, the false `window.print()` premise replaced with the real argument from
§7.7 (a brief meant for circulation that prints badly does not circulate), and both marked as
user-approved additions outside §3's Changed table. Neither changes rendered output - a URL is not
on screen and `@media print` never affects it - so neither needs an `ALLOWED_DIFFS` entry and the
guard is untouched. Task 11 proceeds as planned, with deep links treated as untrusted input:
unknown parameters ignored, out-of-range values falling back to defaults, and slider movement
replacing history rather than pushing it.

**Ruling 38 - the state boundaries come from a dedicated ADM1 file, not the basemap. Ruling 33
resolved.**
The user chose GRID3 over accepting the bleed or clipping by geometry. Sourced and verified:
`data/boundaries/nga-adm1.topojson`, **37 features** (36 states + FCT), 260 KB, every feature
`shapeGroup: NGA`, so Nigeria-only by construction. The basemap's own admin lines are dropped for
this layer; its `boundaries` source still supplies the national outline (ruling 30).

**Provenance, stated precisely because the user asked for GRID3 and this is not GRID3's own file.**
GRID3's *NGA - Operational State Boundaries* lives on their ArcGIS Hub, is dated 2020, is labelled
"administrative (non-authoritative)", and its page is JavaScript-rendered - the FeatureServer URL
did not resolve through the Hub API, so it could not be fetched programmatically. What I fetched is
**geoBoundaries gbOpen NGA ADM1** (release `9469f09`, ODC-ODbL, updated 2025-08-26), which is open,
versioned, current and in the right format. A search summary claimed HDX lists GRID3 as its source,
but the HDX record's organisation is geoBoundaries, and I am not going to assert a provenance I did
not verify.
*Told to the user plainly*, with the note that GRID3's own GeoPackage can be dropped in by hand and
pointed at - the work is identical, only the path changes. `data/boundaries/README.md` carries all
of this next to the file.

*Implementation:* folded into Task 12 rather than reopening Task 6, since Task 7 is live in the same
files right now. It needs the `ALLOWED_DIFFS` entry for bug 6 updated again - the citation is
already `§9.1 bug 6 / §8.3` and gains this - and the rail chip stays `37`, which is now literally
the feature count.

## Coordination note for Tasks 8 and 9 — the interpolated ink scale needs ONE home

The original has two continuous scales, `hotScale` and `coldScale` (lines 569-570), which
interpolate across all five steps of a ramp. They are used as a **text** colour in three places,
and that is what forced the whole ink scale into existence (spec §5.3):

| Consumer | Where | Size |
| --- | --- | --- |
| Table `suhii` column | Task 9 | 12px |
| Compare card SUHI figure | Task 8 | 13px |
| Drawer `.pill` and the tooltips (`spotFill`) | Task 7 | 9.5px and 13px |

The rail's components use **discrete** ink tokens, which is correct for them - a KPI figure is
`--hot-4-ink`, not an interpolation. But nothing committed yet exports an **interpolated** ink
scale, and Task 7 is currently creating `src/map/ink.ts` for its own use.

Three consumers deriving the same interpolation separately is how the Compare tab and the Table
end up disagreeing about the colour of the same number - the identical failure mode ruling 36
guarded against for the day/night aggregation.

*To do when Task 7 lands:* check whether its `src/map/ink.ts` is the right home. If it is, Tasks 8
and 9 import from it and the file moves somewhere less map-specific. If it is private to the map,
the shared scale goes in `src/lib/` beside `encode.mjs`. Either way **one definition**, and the
fill-vs-ink split stays: map polygons interpolate the FILL ramp, text interpolates the INK ramp.
Put it in both briefs.

## User report, 2026-10-26: "the basemap is not applying on the map canvas"

Investigated on the live dev server with Playwright at 1440x900, clicking each option and
measuring the map area pixel by pixel:

| Comparison | Pixels differing by >8 | Share of the map area |
| --- | --- | --- |
| Dark vs Topo | 818,793 | **94.8%** |
| Topo vs Plain | 818,765 | **94.8%** |
| **Dark vs Plain** | **209** | **0.0%** |

**The wiring is fine.** `aria-pressed` moves correctly, the `setStyle` effect has `baseKey` in its
dependency list, and switching to Topo repaints essentially the whole map. The user's observation
is still correct, for a reason the wiring cannot show:

**In Nocturne, "Dark" and "Plain" render identically.** `dark` is `palette: 'nocturne', detail:
'full'`; `plain` is `palette: 'theme', detail: 'ground'`. In the Nocturne theme `palette: 'theme'`
**resolves to nocturne**, so the only difference left is `full` versus `ground` - and the detail
that distinguishes them (roads, landuse, landcover) is not drawn at national zoom anyway. Two of
the three options are the same picture. The user clicked Plain, saw nothing change, and reasonably
concluded the control was dead.

**This is a design defect in ruling 29's variant scheme, not a bug.** I invented three variants
without checking that they are distinguishable in both themes. By the same logic, in Modernist
"Topo" and "Plain" will be the identical pair.

Compounding it: the note under the segment still reads *"Esri and Carto tile services - free, no
key required"* (Task 12 item 1). A control that appears to do nothing, over a caption naming
providers we no longer use, is why this read as broken rather than subtle.

*Not fixing unilaterally* - the segment's options are a visible part of the approved design and the
user has overridden me on basemap questions twice. Put to them with the measurements.

**Ruling 39 - the basemap segment becomes two options, Dark and Light. User's choice, 2026-10-26.**
Resolves the defect above: three variants of which two rendered identically per theme.

```
dark:  { label: 'Vector Dark',  palette: 'nocturne',  detail: 'full' }
light: { label: 'Vector Light', palette: 'modernist', detail: 'full' }
```

`plain` is deleted, and with it the `palette: 'theme'` mode and the `detail: 'ground'` mode - both
existed only to serve it. Each remaining palette is **fixed**, so the two are always distinguishable
whatever the UI theme, which is the property my three-variant scheme lacked. The labels still come
from the second word of the label, matching the original's `BASES` convention
(`'Esri Dark'` to `Dark`), so `Vector Dark` and `Vector Light` give `Dark` and `Light`.

This is also closer to what the original's five Esri options were really offering: a choice of
ground, not five providers. Dark Gray / Topo / Shaded Relief / Light Gray / Imagery is two grounds
and three textures.

**Ruling 7's latch still works and reads better.** A theme change drags the basemap by key until the
reader picks one; the mapping becomes `nocturne -> dark`, `modernist -> light`, which now says
exactly what it does. Previously `modernist -> topo` was opaque.

*Knock-ons:*
- `ALLOWED_DIFFS`'s `.seg button` entry cites §8.3 and stays, but its measured widths (56.67 to
  95.80 px Nocturne, 53.59 to 90.66 Modernist) were taken with three buttons and will be wrong with
  two. Re-measure and update the `why`.
- `style.test.ts` and `BasemapSeg.test.tsx` both assert against three keys.
- A deep link carrying `base=plain` or `base=topo` must fall back to the default rather than break -
  that is Task 11's untrusted-input rule, and this is its first real case.

*Sequencing:* **not applied yet.** Task 7 is live in `App.tsx` and `MapStage.tsx` and runs the full
suite plus the fidelity guard; changing the basemap under it would fail its run for reasons that are
not its fault. Same call as Task 4's segment. Applied as soon as Task 7 commits.

## Task 10 pre-flight, second pass — the exports do not exist

**Ruling 40 - implementing export COMPLETES a promise the UI already makes, so it is in scope. Not
the same case as deep links.**
`renderReport` draws six `.card2` export cards, each with a title, a description and a
`<button class="ghost">Download</button>` - and **the button has no handler**. There is no `Blob`,
no `createObjectURL`, no CSV or GeoJSON serialisation anywhere in the prototype's 1,179 lines. Six
buttons that look functional and do nothing.

So Task 10's `buildExport(format, rows, filters)` is not a transcription of anything. The question
is whether it is a new feature needing the user's approval, like deep links (ruling 37).

**I rule that it is not**, and the distinction is worth stating because it is the line I have been
holding all project:
- Deep links were a capability the original **never hints at**. Nothing on screen suggests the URL
  means anything. Adding them is adding a feature.
- The export cards **advertise specific deliverables**: "Spot records (CSV) - 441 rows · 30 fields",
  "Contours (GeoJSON) - EPSG:4326, current view". §7.7's own lede promises "the underlying records
  for analysis". The UI makes a concrete promise and does not keep it.

That is nearer §9.1 bug 7 - a KPI tile missing the `.val` its siblings have - than it is to a new
feature. Building it makes the page do what it already says it does.
*Flagged to the user anyway*, because it is a judgement call on the scope line and they have been
making those. If they disagree, the cards render and the button does nothing, exactly as today.

*Note:* the header's `#exportBtn` does work - it calls `selectTab('report')`. Task 2 reproduced that
correctly.

### Task 7 — map interactions

Commits `e46728d` and `f28169f`. Controller-verified: 272 tests / 29 files, audit 80/80, build
clean, **fidelity 6/6** with all six `task: 7` PENDING lines deleted and no new `ALLOWED_DIFFS`
entry. Screenshots re-taken and the basemap is visible in both.

**It found two defects in the guard that matter more than its feature work.**

*First:* deleting the six PENDING lines **alone would have produced zero coverage**. Five of those
selectors exist only while the drawer is open - on **both** pages - so each would have fallen
through `if (!o.present) continue`. Six deletions, nothing compared, and a green 6/6 that looked
like six wins. The guard now opens the same city on both pages after the main capture and measures
17 drawer selectors, every one scoped to `.drawer` (Task 5's first-match limitation: `.dl2`,
`.kpis`, `.kpi`, `.bar`, `.rowlist` and `.rw` all exist in the rail too). **This is the second time
the "guard the guard" assertions earned their place** - the first was Task 3's `compared.length`
floor, and this is exactly the hole that floor was too coarse to catch.

*Second:* `vite.config.ts` needed `test.css: true`, because bug 8's `prefers-reduced-motion` block
is a CSS rule, jsdom does not evaluate media queries, and Vite's `?raw` returns an **empty string**
by default - 0 characters before the change, 18,087 after. That test would have passed having read
nothing.

**Ruling 41 - ruling 13's conclusion was right and its mechanism was wrong. SVG, not HTML.**
I wrote that a dashed ring is "`border: 1px dashed` on a `border-radius: 50%` element and the CSS
transfers verbatim". It does not: **CSS `border-style: dashed` has no dash length**, so
`dashArray: '4 3'` is unexpressible as a border, and an HTML div is hit across its whole box while
the original's `fill: false` marker is hit **only on its stroke** - so divs would swallow hovers
over the very polygons they annotate. Leaflet drew these as SVG. So the verbatim transfer is
`<circle fill="none" stroke-dasharray="4 3">`, and HTML would have been the substitute.
*Accepted as implemented.* Still DOM overlays positioned with `map.project()` (ruling 13's
conclusion stands); labels stay divs, where `.citylabel`'s doubled `text-shadow` does transfer.

**Ruling 42 - `.rw` in the drawer stays a `div` with `role="button"`.** The implementer asked
whether Task 5's precedent is the pattern for every clickable row. It is: `.rw` sets a `font-size`
but no `font-family` and no `background`, so a real `<button>` inherits the UA font and grey ground
and the fidelity guard fails on both. A `div` with `role="button"`, `tabIndex` and key handling is
the faithful transfer. **This is now the project's standing rule for clickable rows**, alongside
Task 2's native `<select>` and Task 5's native `<input type=range>` - three cases of the same
lesson: the original's CSS was written for a specific element, and swapping the element breaks the
CSS whatever the semantics gain.

**Measured: the second WebGL context costs ~1.7-1.9x per-frame render.** 4x CPU throttle, median
frame over a 40-step pan: **257.5 ms with two instances versus 149.6 ms with one (1.72x)**; p95 301
vs 188; heap +2.1 MB; DOM nodes unchanged. Unthrottled 231 vs 119 (1.94x). The implementer is right
that the **ratio** is the portable number - headless Chromium had no hardware GPU, which is also why
throttling barely moved it. Verdict: unnoticeable on a desktop or projector, the difference between
a smooth pan and a heavy one on a mid-range phone. It did not pre-emptively drop to one instance,
as instructed. **To the user with Task 12's bundle measurement**, where the whole weight question
gets decided together rather than piecemeal.

**Accepted judgement calls:** Radix's non-modal dialog hard-codes `trapFocus: false` and
`forceMount` stops its focus hooks firing, so Escape and the dialog role come from Radix while
initial focus, Tab cycling and restore are hand-written and held by a test - `modal` was not an
option, it would `aria-hidden` the document and block the map. `Math.max(2.5, r)` is dead code
(`popScale`'s range starts at 3, so the floor never fires for any city, metric or mode) -
transcribed rather than deleted, and stated in a test. `swipeGeometry` rounds to 4 dp where the
original writes `55.00000000000001` into `style.left`; a deliberate, unmovable departure.

**Ruling 39 applied.** `BASEMAP_VARIANTS` is two fixed-palette entries, `plain` is gone with the
`palette: 'theme'` and `detail: 'ground'` modes, the latch maps `modernist -> light`, and the
`.seg button` exemption is re-measured: **56.67 -> 144.70 px Nocturne, 53.59 -> 137.00 px
Modernist** (five buttons to two). 272 tests, audit 80/80, build clean, fidelity 6/6.

**One real consequence surfaced while fixing the tests.** With fixed palettes, `style(theme, base)`
no longer resolves the palette from the UI theme - so the national outline and state lines take the
**variant's** palette, not the active theme's. Two tests asserted `THEME_TOKENS[theme]` and failed
with modernist's `#201e1d` where they wanted nocturne's `#595d6c`. That is correct behaviour, not a
regression, and the tests now resolve through `variantTheme(base, theme)`.

It is worth being precise about what this does to §8.3's claim that the basemap "flips with
`data-theme` like everything else". **It still does, but by a different mechanism:** ruling 7's latch
changes the KEY on a theme change (`nocturne -> dark`, `modernist -> light`), so the default basemap
follows the theme exactly as before. What changed is that an explicit pick now sticks to a palette
rather than to a palette-resolution rule - which is what the original's `userPickedBase` always
meant. Coherent, and arguably clearer than ruling 29's three-way scheme.

The latch test got stronger in the process: the reader now picks **the option the active theme would
not have chosen**, so a broken latch would drag the key back and fail the next assertion. With three
options it picked `plain`, which the theme never chose anyway, and proved less.

## Task 9 pre-flight — one of my tests has nothing to test

Checked all 17 table columns against `data/cities.json`: **all present, and not one null in any of
them across all 55 rows.** So the plan's `test('a null cell renders an em dash')` cannot be
exercised by the real data.

Same class as ruling 23, where I specified a diacritic-folding test against 55 city names that are
all ASCII. Twice now I have written a test for a condition the dataset does not contain.
*Decision:* keep the test but **drive it from a fixture**, and name it so the reader knows the data
cannot reach it - something like "renders an em dash for a null cell, which no city currently has
but derive.mjs can still produce". `fmt()` already returns an em dash for null (Task 4 proved that
by mutation, getting `NaN °C`), so the behaviour is real even though the data never triggers it. A
test that silently uses a fixture while reading as though it checks production data is worse than
no test.

*Also noted:* the table uses 17 of the 25 fields. The other eight are not dead - `lat`/`lon` feed
the map, `city_area` the KPI share, `sig` the Reports brief, `pct_cold` Compare - so nothing here
suggests trimming `derive.mjs`'s output.

### Task 8 — Compare, and the derivation behind it

Commits `9d198c7` (derivation) and `96e106c` (Compare), plus my follow-up. Controller-verified:
**308 tests / 30 files**, audit 80/80, build clean, **fidelity 6/6**, and
`git diff --exit-code data/cities.json data/clusters.json data/spots.topo.json` exits **0** - the
gate that mattered most for the first task to touch `scripts/` since plan 1.

**Ruling 43 - §9.1 gains BUG 11: the bare `+` before `suhii`. Fixed in three places.**
The implementer transcribed `+${c.suhii}` faithfully, producing `+-0.66 °C`, and raised it rather
than silently correcting. **It is a defect, not a style**, and the proof is in the original itself:
the same value is formatted `suhii > 0 ? '+' : ''` at prototype lines 812, 861 and 886, and bare at
871, 936 and 1083. **The original disagrees with itself, and one of its two spellings produces
nonsense** for 18 of the 55 cities - Maiduguri among the picker's defaults, so it is on screen by
default.

Task 7 had faithfully reproduced the bare `+` in the city tooltip and the city drawer too, so the
rebuild carried it in three surfaces. All three now use the sign test; the three that already had it
are untouched. Added to §9.1 as bug 11 with an `ALLOWED_DIFFS` entry. The pinning test was rewritten
from "reads +-0.66 exactly as the original does" to assert the fix, **plus a second test that a
positive city keeps its plus** - without that, deleting the sign entirely would have passed.

**Ruling 44 - national-max scaling now takes its max over `cities-by-period.json`.** Still national,
still not per selection. The formula had to move because against `d3.max(CITIES, …)` **19 of 954
bars exceed 100% and clip** - Akure's day SUHI is 3.66 against a pooled maximum of 2.34, since
pooling across periods hides the per-period extremes. A bar that clips is a bar that lies about its
own scale. Accepted.

**Ruling 45 - `#cmpLegend` is a sanctioned addition.** The original has no equivalent, but §7.5 fixes
both bar gradients, so day and night are distinguished **only by opacity**. Without a key the pairing
is unreadable, and a chart that cannot be read is not a faithful rendering of one that could.
`ALLOWED_DIFFS` entry cites §7.5.

**`.card2` and `.cmp` are +151.69px taller** (Nocturne; +151.68 Modernist) - nine measures each
gaining a second bar row. Registered citing §7.5, same reasoning as ruling 26's `.kpis` entry: a
sanctioned change's own geometry.

**My 106-vs-110 assumption was wrong, and the implementer corrected it.** It is not four city/period
pairs lacking L50 spots: **four cities have zero features at any level for one period** - Abonnema
has no night, and Ado Ekiti, Port Harcourt and Warri no day. `Bida|night` is a separate case and is
the `encode.mjs` one: it has both periods, but its single night feature carries no LST, so the split
surfaces a null the pooled table hid. Both render as a track with no bar and an em dash with no
unit - never zero, because zero is a real value in this data and absence is not.

**The best thing in the report: a test that passed under its own mutation.** Its first per-period
multiplicity test could not fail, because `suhii`, `slope` and `hotdays` are constant across every
row of a city+period - the weighting is provably a no-op in that table. It renamed the test to say
so and moved the all-levels rule onto `mean_lst`, which moves 96 of 106 rows. That is the mutation
discipline catching a test that proved nothing, which is exactly what it is for.

**Also:** a Task 4 assertion in `Kpis.test.tsx` queried `.cbar` document-wide and asserted every bar
was empty - true only while nothing outside the rail had bars. Scoped to `#rail`. And `src/map/ink.ts`
was **not** moved: it already imports from `src/rail/stats`, so it is not map-private, and
`Compare.tsx` imports `hotInkScale` from it. One owner, as required.

## Task 12 item 8, measured — and there is an obvious fix that costs no fidelity

Re-verified security first: **`npm audit --omit=dev` is 0** even after MapLibre, Leaflet,
Playwright, TanStack, Observable Plot and pmtiles were added. The two dev-only advisories
(`tinypool` critical, `@vitest/mocker` moderate) are unchanged and still reach nothing that ships.

Bundle, measured gzipped, which is what crosses the wire:

| | raw | gzip |
| --- | --- | --- |
| `index.js` | 1,409 KB | **405 KB** |
| `maplibre-gl-worker.js` | 494 KB | **142 KB** |
| `index.css` | 109 KB | **16 KB** |

**MapLibre is essentially all of it** - 338 references to it in the main chunk, against 77 for
React and 9 for Radix. TanStack and Plot are not in there yet.

**And it is statically imported** (`src/map/MapStage.tsx:44`), so every visitor downloads the whole
map engine before the page renders - including a ministry official who opens the Data table from a
deep link and never touches the Map tab.

*Recommendation for Task 12:* put `MapStage` behind a dynamic `import()` and lazy-render it. The
Map tab is the default, so the common path is unchanged; what changes is that Compare, Table and
Reports stop paying 405 KB plus a 142 KB worker for an engine they never use. **This costs no
fidelity at all** - the guard compares the Map tab with the map rendered, exactly as now - which
makes it the one weight saving available that does not trade against §3. Worth doing before the
second-instance question (ruling 35, ~1.7x per-frame) gets decided, because it changes the terms:
a lighter first paint buys headroom the swipe can spend.

*Also for Task 12:* the CSS went 27 KB to 109 KB raw when the map landed, which is `maplibre-gl.css`.
It gzips to 16 KB, so it is not urgent, but it is worth checking how much of that stylesheet a map
with no symbol layers and no default controls actually needs.
