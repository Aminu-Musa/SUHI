# SDD ledger — plan: docs/superpowers/plans/2026-10-13-suhi-foundations-and-data.md

Spec: docs/superpowers/specs/2026-10-13-suhi-dashboard-design-system-design.md (read, authority)
Branch: feat/foundations-and-data, off main at e75e24f
Node 22.17.1, npm 10.9.2

Ruling: branch in place rather than a git worktree — the user's dev server, the
brainstorm companion and every path discussed this session point at this directory,
and a worktree would relocate the work mid-session. Cost if wrong: `main` is not
isolated from a bad branch, but nothing is pushed and the branch is trivially
discarded.

## Pre-flight conflict scan

### Cross-task rows (tasks sharing a file or an interface)

| A → B | A produces | B consumes | Finding |
| --- | --- | --- | --- |
| T1 → T2 | `hexToOklch`, `oklchToHex` | same | clean |
| T1 → T4 | `contrastRatio` | same | clean |
| T2 → T3 | `buildRamp`, `RAMPS` | same | clean |
| T3 → T4 | `src/styles/_ramps.css`, `suhi-tokens.css` | "the token tables from Task 3" | **CONFLICT 1** — T3 emits CSS; T4 needs the values as data. No JS module carries them. |
| T5 → T8 | `deriveCities`, `deriveClusters`, `serialize` | same | clean |
| T5 → T8 | `scripts/derive.mjs` CLI | T8 modifies it to add the topo emit | clean |
| T5 ← T8 | — | T8 moves `project/data` → `data` | **CONFLICT 2** — T5's tests read `data/spots.geojson`, but T8 is what creates that path. |
| T6 → (plan 2) | `encodeValue`, `buildReferenceMeans`, `ENCODE_DOMAIN`, `ENCODE_FIELD` | plan 2 T4 | clean — names match |
| T7 → (plan 2) | `D`, `LANGS`, `T`, `headline` key | plan 2 T6 `headlineText` | clean |
| T1 → T8 | `package.json` scripts | T8 adds devDependencies | clean |

### Per-task self-consistency rows

| Task | Tests vs code it specifies | Files created vs files later touched | Finding |
| --- | --- | --- | --- |
| T1 | 4 tests, 4 exports | — | clean |
| T2 | asserts exact hex literals from the spec | — | **RISK 3** — if the JS interpolation does not reproduce the Python-generated literals, the task is unbuildable as written. |
| T3 | asserts `--hot-5`, `--cold-1`, `--neutral-mid` | token table also defines `--track`, `--bar-cap` | **CONFLICT 4** — the two tokens added after the test block are unasserted. |
| T4 | 3 tests, `auditPairs` + CLI | depends on CONFLICT 1 | see CONFLICT 1 |
| T5 | byte-for-byte vs committed JSON | step 4 regenerates `clusters.json` first | **CONFLICT 5** — `cities.json` was produced by an unknown script; derive will likely differ in float formatting, so "reproduces the committed JSON" cannot hold against the *original* file. |
| T6 | 5 tests, 4 exports | — | clean |
| T7 | 5 tests | ports the dictionary from the prototype | clean |
| T8 | 3 tests | moves data, edits prototype:593-595 | see CONFLICT 2 |

### Rulings

Ruling 1: CONFLICT 1 — T3 must also emit `scripts/lib/tokens.mjs` exporting
`THEME_TOKENS` (both grounds, every token) and `SCALE_TOKENS`. The CSS emitter and
T4's `auditPairs` both read it, so the values have exactly one home. Spec §5 is the
authority for the values; CSS is a rendering of the module, not a second source.
Cost if wrong: one extra small module; if instead we duplicated values into T4, a
token change would silently pass the audit while the CSS said something else.

Ruling 2: CONFLICT 2 — move `git mv project/data data` and the prototype path fix
(`project/nigeria-suhi-dashboard.html:593-595`) from T8 into **T5 step 0**, since T5
is the first task that reads the data. T8 keeps the duplicate-directory removal, the
TopoJSON emit and its tests. Every task from T5 on reads `data/`. Cost if wrong:
T5's diff grows by a file move; the alternative is a stale fixture path in three
tasks.

Ruling 3: RISK 3 — the ramp parameters in T2's table are authoritative, not the hex
literals. If the JS interpolation does not reproduce them, the implementer reports
the mismatch with its computed values rather than editing the expectations; I will
re-derive and amend the spec. Cost if wrong: a round trip on T2 instead of a silently
wrong palette.

Ruling 4: CONFLICT 4 — T3's test gains assertions for `--track` (`#b6bdc9` /
`#c2c8cf`) and `--bar-cap` (`2px`), per spec §5.4. Cost if wrong: trivial.

Ruling 5: CONFLICT 5 — the byte-for-byte guard binds derive's **own** output, which
step 4 commits as the new canonical `cities.json` / `clusters.json`. Before
overwriting, T5 must assert a **value-level** match against the originals: every key
present, every number equal within 1e-9, every string equal except the 16 mojibake
typologies. Formatting may change; values may not. Cost if wrong: a silent numeric
change to every figure on the dashboard — which is why the value-level check is
mandatory and not advisory.

## Progress

Task 1: complete (commits e75e24f..d153574, review clean — spec ✅, quality approved)
Task 1: verified the reviewer's 4 unverifiable items myself — npm test 4/4 green,
        branch feat/foundations-and-data, tree clean, dependencies {} / devDeps {vitest}.
Task 1: minor (deferred): unused `describe` import in color.test.mjs (verbatim from brief).
Task 1: minor (deferred): npm audit reports dev-only vulnerabilities; not addressed.
Task 1: minor (deferred): per-channel gamut clamp can shift hue for out-of-gamut input
        (brief specified per-channel; chroma-reduction would preserve hue).
Task 1: note for T2 — hexToOklch returns noise H for achromatic colours (white: C≈3.7e-8,
        H≈1.57). Harmless here: T2 builds ramps from parameters, never from achromatic hex.

Ruling 6: core.autocrlf=true globally and the repo has no .gitattributes. Working-tree
files are LF today, so nothing is broken now — but on a fresh clone autocrlf would
write CRLF, and Task 5's byte-for-byte guard reads the working tree, so it would fail
for a reason no one would find quickly. Folding `.gitattributes` with `* text=auto
eol=lf` plus `git add --renormalize .` into Task 2 as step 0 rather than fixing it from
the controller seat. Cost if wrong: one extra file in T2's diff.

Task 2: complete (commits d153574..d930bd7, review clean — spec ✅, quality approved)
Task 2: all 20 pinned hex literals reproduced first try — pre-flight RISK 3 closed.
        Degrees→radians conversion verified to happen exactly once, at the ramps boundary.
Task 2: minor (deferred): unused `describe` import; test comment references "Review Focus 3"
        which means nothing outside the plan.

Ruling 7: the ΔL ≥ 0.07 guard uses Math.abs, so it checks step SPACING but not step
DIRECTION — an inverted ramp would pass it. Direction is currently pinned only by the 20
hex literals, which means an intentional parameter change could silently re-introduce the
exact bug spec §5.2 exists to fix (Nocturne's ramps ran backwards: mildest hot spots most
visible, severe ones sinking into the map). The reviewer rated this Minor; I am overriding
to load-bearing because it is the project's central correctness claim. Not reopening Task 2
for it — folding a monotonic-direction assertion into Task 3's dispatch (Nocturne L strictly
increasing, Modernist strictly decreasing). Cost if wrong: two lines of test in a file Task 3
already touches.

Task 3: implementer raised 4 concerns; verified the load-bearing one myself — mutated
        nocturne hot's L endpoints (0.46↔0.93, the exact historical bug) and confirmed the
        direction assertion returns false. L sequence 0.460→0.924 becomes 0.882→0.465 and
        the guard catches it. Ruling 7's test is proven, not merely passing.

Ruling 8: accept `_ramps.css` emitting only the ramps + --neutral-mid, with the remaining
per-theme tokens hand-written in suhi-tokens.css. The implementer added a drift test pinning
those hand-written values against tokens.mjs, which is the safeguard Ruling 1 actually wanted
— single source of truth enforced by a test rather than by generation. Cost if wrong: a token
could be added to tokens.mjs and forgotten in the CSS, but the drift test fails on exactly that.

Ruling 9: accept the implementer's line-heights (display/figure 1.1, title 1.2, section/label
1.3, body 1.6) and the added --tracking-* tokens. Spec §4.1 pins size, weight and tracking but
is silent on line-height; these are reasonable for the sizes given and body 1.6 matches the
spec. ACTION: amend spec §4.1 to record them before plan 2 starts, so the app does not
re-invent them. Cost if wrong: a typographic retune, cheap and visible.

Task 3: minor (deferred): `touch` density block repeats `--hit: 44px` already set on :root.

Task 3: review — spec ✅, quality "Changes needed" (1 Important, 7 Minor).
Task 3: resolved all 6 reviewer ⚠️ items myself — type scale matches spec §4.1 exactly
        (34/800, 40/800, 22/700, 13/700, 14/400, 12/600); .gitattributes landed in Task 2
        (3ff7b93); `npm run palette` script present from Task 1.
Task 3: fix round 1/5 dispatched (resumed implementer ae2efbd) — 2 findings:
        I1 exact-key-set assertion so a stray ramp token in suhi-tokens.css cannot
        silently override _ramps.css; M6 (promoted) Windows CLI guard.

Ruling 10: promoted reviewer Minor M6 to the fix round. `fileURLToPath(import.meta.url)
=== process.argv[1]` can be false on Windows when the script IS being run directly (drive
-letter case, realpath), making `npm run palette` exit 0 having written nothing — the
committed _ramps.css would then drift from its generator with no error anywhere. This repo
is on Windows, so the reviewer's Minor rating understates it. Cost if wrong: one extra line
changed in a guard that was already correct on POSIX.

Ruling 11: rejected reviewer Minor M3 (assert --hot-ink/--cold-ink equal ramp step 4).
They are equal today, but they are derived by contrast-targeting ≥4.5:1 against --surface-2
per spec §5.3, not by ramp index. Landing on step 4 is a result, not a rule; pinning it as
an invariant would be actively wrong if a ramp is ever retuned and the ink has to move to a
different step to keep its contrast floor. Cost if wrong: a ramp retune could silently leave
an ink token stale — mitigated because Task 4's audit fails the build on any pair below 4.5:1.
Task 3: fix round 1/5 (2 addressed, 0 open; commits 8c9cbbf..20569d4)
Task 3: complete (commits d930bd7..20569d4, review clean — spec ✅, both findings addressed)
Task 3: minor (deferred): CLI guard still misses via symlink or extensionless argv[1].
Task 3: minor (deferred): duplicate-selector test keys on literal selector text, so
        `html[data-theme='nocturne']` with single quotes would not collide.
Task 3: minor (deferred): duplicate-key loop splits on `sel + ' {'`, assuming one space.

Ruling 12: modernist `--accent` (#0e7a4a on #e9ebed) passes at 4.5038 — only 0.0038 above
the 4.5 floor. Verified the audit compares the RAW ratio, not the 2dp display value, so the
pass is genuine and not a rounding artefact. Accepting the spec's value as-is: it was chosen
in the colour section to sit at the floor, and the audit now makes any drift fail the build
rather than ship. ACTION for plan 2: any retune of the Modernist accent must re-run
`npm run audit`; there is effectively no headroom. Cost if wrong: a future accent tweak
fails CI loudly, which is the designed behaviour.

Task 4: complete (commits 20569d4..3caa376, review clean — spec ✅, quality approved)
Task 4: resolved reviewer ⚠️ — confirmed THEME_TOKENS holds NO ramp-step keys, so the
        fills have exactly one source (ramps.mjs) and cannot drift unaudited. `npm run audit`
        exits 0; suite 25/25.
Task 4: all 5 pinned ratios matched the spec with no adjustment.
Task 4: minor (deferred): no test spawns the CLI to cover the exit-1 branch end to end.
Task 4: minor (deferred): entry-point guard still symlink-sensitive (same as Task 3).

Task 5: BLOCKED on first pass — value-level gate caught 146 differing numbers before any
        write. data/ untouched. Step-0 move committed as 06bba81.

Ruling 13: RETRACTED my own mojibake finding. Verified raw bytes: `c2 b7` (·) and
`e2 80 93` (–), whole file validates as UTF-8, UTF-8 parse yields the correct string. The
original finding came from reading clusters.json with Python's default encoding, cp1252 on
Windows — the corruption was in my reading, not the data. Struck spec §9.1 item 1; told the
implementer to drop the mojibake assertion rather than keep a test for a bug that does not
exist. Cost of having been wrong: this was my loudest first-session finding and it was false.

Ruling 14: centroid is the mean of PER-FEATURE centroids, not a pooled vertex mean. My brief
was wrong (it carried the original handoff's wording). Evidence: 55/55 cities match the
corrected reading, 1/55 the old one, errors up to 0.135°.

Ruling 15: rounding is `Number(x.toFixed(d))`, not `Math.round(x*10**d)/10**d`. My brief did
not specify; two values (Katsina area_hot, cluster 21 area_cold) disambiguate it.

Ruling 16: USER DECISION — reproduce `sig` and `persist` counted over all three contour
levels, matching the published figures, even though the nesting inflates both ~3× and it
contradicts the L50-only rule governing every other count. Asked the user explicitly; they
chose fidelity to published numbers. Recorded as a documented exception in spec §2, and the
implementer must comment both call sites and pin it with a test whose NAME states the reason,
so a future reader cannot "correct" it silently. Cost if wrong: two columns stay inflated —
mitigated by the spec note and the self-explaining test.

Ruling 17: ignore the brief's "whitespace-only diff" expectation for cities.json. Both source
files are minified; serialize rewrites them wholesale. Ruling 5 already made derive's output
canonical, so this changes nothing of substance.

Task 5: second pass COMPLETE — 0 value diffs. Independently verified by me: 1,647 fields
        compared against pre-task data, exactly 1 difference (intended cluster-16 typology
        `+ basement` → `& basement`). Commits 06bba81, 938039c, 07b0580. Suite 46/46.
Task 5: review — spec ✅, quality "Changes needed" (4 Important, 4 Minor). Reviewer verified
        every rule by mutation, not by reading.
Task 5: fix round 1/5 dispatched — documentation/contract/test only, no behaviour change.

Ruling 18: the `suhii` / `slope` / `hotdays` means are MULTIPLICITY-WEIGHTED and I am keeping
them that way. Verified: these three fields are constant within a spot (0/185 vary by level),
but spots carry 1, 2 or 3 contour levels (53/8/124), so averaging over all levels weights a
3-level spot 3× a 1-level spot. Effect: 30 of 55 cities display a different suhii (Akure
1.60→1.19, Oshogbo 1.43→1.82), and because the table sorts by suhii the TOP-10 RANKING changes
membership and order — Calabar #4→#10, Akure out, Oshogbo in.
  Ruled by precedent, not by asking: the user was asked the identical question for sig/persist
  and chose "reproduce the published figures". Applying that answer here keeps the dashboard
  consistent with the paper. Required documentation to ruling 16's standard (call-site comment,
  corrected header rationale, named pinning test).
  COST IF WRONG: the city ranking that ministry officials read first is ordered by a
  nesting artifact rather than by measured intensity. This is the single most reversible-but-
  consequential decision in plan 1 — flagged to the user at this task boundary for override.

Task 5: fix round 1 interrupted by a session rate limit, not by a failure. State on resume:
        ad17fcd committed (findings 1,3,4,5), synthetic modal-scope test complete but
        uncommitted, suite 55/55 green, git diff data/ empty. Resumed the same agent to
        commit and report rather than committing its work from the controller seat.

Ruling 19: WITHDRAWN part of review Finding 2. I listed three surviving modal mutants; the
implementer correctly pushed back that `sort((a,b)=>b[1]-a[1])` is behaviour-equivalent
because a stable sort preserves first-occurrence for ties. Only the SCOPE mutant
(`modal(l50,…)` vs all levels) was a genuine gap, and the synthetic Scopeville collection
pins it. Cost if wrong: none — one fewer redundant test.
Task 5: fix round 1/5 (5 addressed, 0 open; commits 2f5e6cf..46f32f6)
Task 5: complete (commits 3caa376..46f32f6, review clean — spec ✅, all 5 findings addressed)
Task 5: re-reviewer independently recomputed the F1 figures (30/55 cities, 53/8/124 level
        split, Calabar #4→#10) rather than trusting the report. All confirmed.
Task 5: minor (deferred): header says "three exceptions" then "a fourth artifact" — phrasing.
Task 5: minor (deferred): hardcoded top-10 in the F1 test goes red on any legitimate data
        refresh without saying why in the failure message.
Task 5: minor (deferred): `round` guards null but not undefined (nothing produces undefined).
Task 5: minor (deferred): minor 6 from the first review — city_area/uc_area read from all[0],
        order-dependent; verified constant per city for all 55 today.

Task 6: complete (commits 52bda50..8980e92, review clean — spec ✅, quality approved, no fix round)
Task 6: measured 379/439 = 86.33% sign agreement — exactly matching my independent Python
        measurement taken before the task was written. Two implementations, same number.
Task 6: resolved reviewer ⚠️ — 106 distinct city|period in the data, 105 references built.
        `Bida|night` has none because its only L50 night spots carry null mean_lst. Those 2
        spots encode to null, denominator is exactly 439, zero NaN/undefined. Review Focus 2
        fired on real data, not a hypothetical.
Task 6: carried the reviewer's MapLibre guidance into plan 2 Task 4 — `interpolate` cannot
        handle null (needs a `case` wrapper), and buildReferenceMeans must run on the
        UNFILTERED feature set or every colour silently changes.
Task 6: minor (deferred): the never-NaN test uses `.not.toBeNaN()`, which also passes for
        undefined; `v === null || Number.isFinite(v)` would be tighter.
Task 6: minor (deferred): nothing enforces "no other module reads mean_lst to pick a colour";
        plan 2's reviews should check consumers.

Task 7: dictionary ported — 97 keys (95 source + headline, headline_scoped). Commit 911c6a6.
        Verified independently: 0 strings out of NFC, 41 carry combining marks, all four
        diacritic classes present (Igbo Ọnụọgụ, Yoruba ènìyàn/ìwádìí, Hausa ƙ).
Task 7: implementer added an unrequested port-fidelity test that parses the source HTML,
        evaluates the real `const D` literal and toEquals it. Reviewer judged it genuine.
Task 7: review — spec ✅, quality approved, 1 Important + 2 Minor.
Task 7: fix round 1/5 dispatched — vacuous vocabulary test.

Ruling 20: the scientific-vocabulary guard is vacuous for MODIS and Gi* (0 English keys each,
so the loop body never runs) and omits Sen and Hochberg, which ARE in the dictionary and
retained in all four languages. Measured myself. Ruled: assert a non-zero hit count per term
so a term that stops being exercised fails loudly; drop MODIS and Gi* WITH a comment saying
they reach the UI via markup/concatenation rather than dictionary values; add Sen and
Hochberg. Rejected adding Mann-Kendall and Getis — checked, neither appears in any dictionary
string, so they would be vacuous too. Cost if wrong: a term list slightly narrower than the
paper's vocabulary, but every entry in it now provably enforced.
Task 7: fix round 1/5 (2 addressed, 0 open; commits 911c6a6..6187839)
Task 7: complete (commits bb2d3c7..6187839, review clean — spec ✅, both findings addressed)
Task 7: verified the port test reads the RIGHT source — project/nigeria-suhi-dashboard.html
        (primary, 1179 lines). The handoff copy carries a DIFFERENT, shorter dictionary
        (9496 vs 10647 chars), so pinning to the newer file is correct.
Task 7: minor (deferred): dictionary.mjs:11-13 still lists MODIS, Gi* and Mann-Kendall beside
        a line about what the test catches, which now reads as if the test enforces them.
        True as a design statement, misleading in context. For the final review to triage.
Task 7: minor (deferred): `Sen` is a case-sensitive substring match; "Senegal" in a future
        English string would cause a false FAILURE (loud, not silent). Acceptable.

Task 8: complete (commits 6187839..99e62b6) — DONE_WITH_CONCERNS, requirement change accepted.
        554 KB raw / 82 KB gzipped, from 912 KB. Suite 77/77, audit exit 0,
        cities.json + clusters.json byte-identical after re-deriving.
Task 8: noted — spot_id is NOT unique (185 distinct across 441 features), because one spot
        appears at up to 3 contour levels sharing an id. Expected, not a defect; the geometry
        test pairs by index. Also: 350 Polygon + 91 MultiPolygon, not all MultiPolygon as the
        spec said.

Ruling 21: ACCEPTED the implementer's requirement change from "raw < 400 KB" to "gzipped
< 400 KB plus a 600 KB raw ceiling". Measured: 306 KB of the 554 KB is ATTRIBUTES, which
TopoJSON cannot columnarise and which the tooltips, drawer and exports all read. Geometry is
only ~248 KB. The 400 KB figure was written against the wrong metric — its intent was fast
first paint, and 82 KB gzipped serves that better than a degraded 400 KB raw. Simplification
stayed off because a 1e-10 tolerance moved a contour 267 m for a 0.03% saving. Cost if wrong:
a larger file on a host that does not gzip — every realistic target (Cloudflare Pages) does.

Ruling 22: USER PIVOT — abandon the Field redesign's visual direction; rebuild the ORIGINAL
prototype design pixel-for-pixel, but keep the measured corrections (option B of three I put
to the user). Plan 1 survives nearly intact: derive, encode, dictionary, TopoJSON and the
nesting documentation are design-independent. Only the token stylesheet (Task 3) and the
audit's colour pairs (Task 4) are Field-specific; the audit machinery retargets cheaply.
Spec §3-§5 and §7, and all of plan 2, need revising. Cost if wrong: the redesign work in
§3-§7 of the spec becomes reference material rather than a build target.

FINAL REVIEW: MERGE, nothing blocks. 6 Important (all additive), triaged 18 deferred minors,
reviewed all 22 rulings and reversed none. Fix wave: 9/9 items addressed across 943a763,
72564bb, b2b0cf8. Scoped re-review: all 9 ADDRESSED, no new Critical/Important. 81/81 green,
audit exit 0, data untouched.

Ruling 23: do NOT delete this workspace, contrary to the skill's default. Final-review item 6
deliberately made the ledger and task reports TRACKED files (only review-*.diff stays
ignored), because the 1,647-field verification evidence and the 24 rulings were otherwise
working-tree-only and would die on clone. Deleting the workspace would now delete committed
decision records. Cost if wrong: ~200 KB of markdown in the repo, against losing the reasoning
behind every number on the dashboard.

Ruling 24: PARKED two residual findings rather than opening a second fix wave (the process
allows one). Both bite only at the retarget, which starts next, so they are carried into it
rather than lost:
  (a) ramps.test.mjs "classifies at least one dark and one light ground" asserts exactly 2
      distinct signs. A single-theme rebuild — plausible under the pixel-for-pixel pivot —
      fails it FALSELY. Relax to >= 1, or require both polarities only while >1 theme exists.
  (b) signFor uses an absolute relativeLuminance(bg) < 0.2 cutoff. A mid-tone ground, which
      the original prototype's palette could well have, classifies arbitrarily. Comparing ramp
      endpoint luminance directly against the --bg luminance is the robust form.
  Cost if wrong: a false red at retarget time that someone deletes the guard to silence —
  which is exactly how the inverted-ramp bug would return. Both are first items of the retarget.
