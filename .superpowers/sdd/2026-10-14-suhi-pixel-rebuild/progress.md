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
