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
