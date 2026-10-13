# Task 5 report — Derive cities and clusters

**Status: BLOCKED** at ruling 5 step 2. Three of the brief's stated aggregation rules,
taken literally, change committed numbers. I stopped before overwriting `data/`, as
instructed. No derive implementation has been committed.

Step 0 (ruling 2, the data move) is **done and committed** — it was independent of the block.

---

## Step 0 — data move (committed)

```
git mv project/data data
```
`project/nigeria-suhi-dashboard.html` lines 593-595 repointed from `'data/…'` to `'../data/…'`
(all three `d3.json` calls; verified zero `d3.json('data/` occurrences remain).
`project/design_handoff_suhi_dashboard/data/` left alone for Task 8.

Commit `06bba812d348ec8f5bb771323339d6c75db4190d` — "chore: move data/ to repo root and repoint prototype fetch paths".

The only remaining `project/data` references in the repo are in two plan/progress markdown
files (`.superpowers/sdd/.../progress.md`, `docs/superpowers/plans/2026-10-13-...md`), not code.

---

## Ruling 6 correction — there is no mojibake in the committed data

The premise is factually wrong for this file. `data/clusters.json` typology strings are
**already clean UTF-8**. Hexdump of the typology region:

```
t y p o l o g y " : " G r a s s l a n d   302 267   1 0 1 342 200 223 5 0 0   m   302 267   M e t a m o r p h i c "
```

`302 267` = `C2 B7` = U+00B7 MIDDLE DOT. `342 200 223` = `E2 80 93` = U+2013 EN DASH.
Both are correct UTF-8 encodings. `/Â|â€|Ã/.test(fileContents)` is **false** for all 16
records. The mojibake `Grassland Â· 101â€“500 m Â· Metamorphic` quoted in the brief and in
ruling 5 is what you get by *displaying* this correct file through a latin-1 console — it is
a terminal artefact, not a file defect.

Consequence: the brief's §9.1 item 1 ("fixes the mojibake") has nothing to fix, and the
Review-Focus-5 test (`expect(c.typology).not.toMatch(/Â|â€|Ã/)`) already passes against the
committed file rather than failing as step 2 predicts. Ruling 6's instruction not to write a
repair step remains correct, for a stronger reason than stated.

## Second format finding — the committed files are minified, not indented

`data/cities.json` and `data/clusters.json` are compact `JSON.stringify(value)` output with
no indentation and no trailing newline (last byte of `clusters.json` is `0x5D` = `]`).
First bytes of `cities.json`:

```
[{"city":"Ibadan","lon":3.9882,"lat":7.3793,"hot":2,"cold":2,"area_hot":89.45,...
```

So `serialize` using `JSON.stringify(value, null, 1)` + `"\n"` will rewrite **every line of
both files**, independent of any value change. This is consistent with ruling 5's conclusion
that byte-for-byte against the originals is impossible, but note the gap is the whole file,
not just a trailing newline, and so the brief's step 4 expectation ("`cities.json` unchanged
or whitespace-only; `clusters.json` changes only in the 16 typology strings") cannot hold
as written even with perfect aggregation.

---

## Ruling 5 step 2 — full value-level comparison

Method: implemented `deriveCities` / `deriveClusters` strictly per the brief, then compared
against the committed originals field-by-field, keyed on `city` / `id`: every key present in
the committed record checked, numbers within 1e-9, strings and arrays exact, `typology`
excepted. Record order also compared.

### Result of the brief-literal implementation: 146 differences

| Field | Records differing | Nature |
| --- | --- | --- |
| `lon`, `lat` | 55 / 55 cities (108 values) | centroid definition |
| `persist` | 30 / 55 cities | L50-only vs all levels |
| `sig` | 8 / 55 cities | L50-only vs all levels |
| `area_hot` | 1 (Katsina) | rounding tie |
| cluster `area_cold` | 1 (cluster 21) | rounding tie |
| everything else | 0 | match |

Record counts (55 / 16) and record ordering both matched on the first attempt.

### The three rule readings, resolved

**1. Centroid — the brief's wording is wrong.**
Brief: "the unweighted mean of every coordinate of every feature for that city." Taken
literally (pool every vertex of every feature, one mean) that reproduces **1 of 55** cities.
Error up to 0.135° — ~15 km, enough to move a marker into the wrong state.

The committed values are the **mean of per-feature centroids**: each feature's centroid is
the unweighted mean of its own vertices, then the unweighted mean across that city's
features, all three contour levels included. **55 / 55 exact** at 4 dp (worst residual
0.00005). Variants tested and rejected: L50-only vertex pool (1/55), L50-only feature
centroids (1/55), bbox centre (0/55), deduplicated vertices (0/55), ring-closing vertex
dropped (0/55).

The two readings differ because features have wildly unequal vertex counts, so pooling
vertices weights a 400-vertex polygon 100× a 4-vertex one.

**2. `sig` and `persist` aggregate over ALL contour levels, not L50 only.**
This directly contradicts the brief's rule ("L50 only for `hot`, `cold`, `area_hot`,
`area_cold`, `pop_hot`, `pop_cold`, `sig`, `persist`").

- `sig` = count of features with `bh_significant === true` over all levels → **55/55 match**.
  L50 only → 47/55.
- `persist` = count of features with `persistent_dn === true` over all levels → **55/55 match**.
  L50 only → 25/55. (Also tested: sum of `n_persistent_events` over all levels 6/55, over
  L50 7/55 — not the rule.)

Worth flagging on the merits, because the L50-only rule exists for a good reason and these
two fields violate it: since L75 and L90 are nested inside L50, a boolean flag that is
constant across a spot's three levels gets counted three times, so `persist` and `sig` are
effectively 3× a spot count. Ibadan's `persist` of 12 is 4 spots × 3 levels, not 12 events.
The committed numbers are inflated by construction. **I am not treating this as a licence to
"fix" it** — your call: reproduce the published numbers, or correct them and accept that
`sig` and `persist` change for 38 cities.

**3. Rounding must be decimal-correct, not scale-and-`Math.round`.**
Two tie cases expose it:

- Katsina L50 hot area sum = `49.094999999999998863` (exact double, *below* 49.095).
  Correct 2-dp rounding → `49.09`, which is committed. But `Math.round(x * 100) / 100`
  gives `49.1`, because `x * 100` evaluates to exactly `4909.5`.
- Cluster 21 L50 cold area sum = `34.649999999999998579` → correct → `34.6` (committed);
  scale-and-round → `34.7`.

`Number(x.toFixed(d))` rounds on the exact double value and gives the committed answer in
both cases, while still rounding Ibadan's `hotdays` 13.5 up to 14 as committed. The original
producer was almost certainly Python (`round()` on the true value).

### Result after adopting all three corrected readings

```
### cities: committed 55, derived 55
ALL VALUES MATCH

### clusters: committed 16, derived 16
ALL VALUES MATCH

TOTAL DIFFS 0
order match cities: true
order match clusters: true
```

Every one of 55 × 25 city fields and 16 × 17 cluster fields matches within 1e-9 / exactly,
`typology` excepted. So the rules are now fully pinned down; the block is a decision, not a
mystery.

### The one excepted string field — and it is not what the brief says

`typology` for cluster 16:

- committed: `Cropland · 101–500 m · Sedimentary + basement`
- brief's table: `Sedimentary & basement formation` → `Sedimentary & basement`

The source `geology_class` is `Sedimentary & basement formation` (clean UTF-8, confirmed).
So the brief's `&` and the committed `+` disagree on the abbreviation. I used the brief's
`&` verbatim as instructed. `typology` is one of the 16 excepted fields, so this does not
itself trigger the block — flagging it so the change is deliberate. **The other 15 typology
strings are byte-identical to the committed ones.** The net effect of "regenerating to fix
the mojibake" is therefore a single `+` → `&` on one record.

---

## Other rules confirmed (no ambiguity found)

- `hot` / `cold` / `area_hot` / `area_cold` / `pop_hot` / `pop_cold`: L50 only, split by
  `spot_type`. Confirmed correct — these are the fields the L50 rule genuinely protects.
- Means over all levels for `suhii`, `mean_lst`, `slope` (`sen_slope_C_per_decade`),
  `hotdays` (`n_modis_hot_days`); `max_lst` is a plain max over all levels, unrounded.
- Rounding: `lon`/`lat` 4 dp; `area_*`, `suhii`, `mean_lst`, `slope`, `pct_*` 2 dp;
  `pop_*`, `hotdays` 0 dp; cluster `area_*` 1 dp; `city_area`, `uc_area`, `max_lst` raw.
- `pct_hot` = L50 hot area ÷ `city_area_km2` × 100, 2 dp. Confirmed.
- Dominant class fields: modal by feature count over all levels, first occurrence wins ties.
- Cities sorted by `suhii` descending, stable, ties keeping first-appearance order from
  `spots.geojson`. Clusters sorted by `id` ascending. Both reproduce committed order exactly.
- Cluster `cities` array is the distinct city list sorted alphabetically; `n` is the feature
  count over all levels.

## Null handling verified — no `NaN` reaches the output

Nulls are more widespread than the brief's "2 features have `mean_lst: null`":

| Field | Null features |
| --- | --- |
| `population` | 26 |
| `mean_lst` | 2 (`bida_nh_T1_001`, `port_harcourt_nh_T1_002`) |
| `max_lst` | 2 |

All 26 null-`population` features are L75/L90, so **zero** L50 features have a null
population and the `pop_*` sums are unaffected — but a derive that summed all levels would
have produced `NaN` for them. `mean_lst` and `max_lst` nulls do fall inside the
all-levels means and max.

Handling: numeric aggregation filters to `typeof v === 'number' && Number.isFinite(v)`;
means divide by the surviving count, not the feature count; an all-null group yields `null`
rather than `NaN`. Scan of the full derived output for `null` or `NaN` tokens: **none**.

## Reference values — all confirmed

| Check | Expected | Got |
| --- | --- | --- |
| Ibadan `hot` / `cold` | 2 / 2 | 2 / 2 |
| Ibadan `pop_hot` | 15378 | 15378 |
| Ibadan `max_lst` | 43.296 | 43.296 |
| total `pop_hot`, 55 cities | 137472 | 137472 |
| city count | 55 | 55 |
| occupied clusters | 16 | 16 |
| mojibake in derived typologies | none | none |

Occupied `cluster25` ids: 1, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 21, 23, 25.

## `git diff --stat data/`

```
(empty — no change)
```

Empty by design: I did not write `data/cities.json` or `data/clusters.json`, because
ruling 5 step 2 directs me to stop before overwriting when numbers differ. `git status`
is clean at commit `06bba81`; the suite is 25/25 green (4 files), unchanged by the move.

---

## What I need from you

Pick one per item. Any combination unblocks me; I can finish in one pass.

1. **Centroid** — confirm the rule is "mean of per-feature centroids, all levels"
   (reproduces committed `lon`/`lat` 55/55), and that the brief's sentence should be
   reworded. Alternative: keep the literal pooled-vertex reading and accept every city
   marker moving by up to 0.135°.
2. **`sig` / `persist`** — (a) reproduce committed: count over all contour levels, and strike
   them from the brief's L50-only list; or (b) correct to L50-only and accept `persist`
   changing for 30 cities and `sig` for 8, with the dashboard's published figures changing.
   I recommend (a) for this task and a separate, visible decision on (b), since (b) is a
   numbers-change for readers, not a bug fix.
3. **Rounding** — confirm `Number(x.toFixed(d))` (decimal-correct) rather than
   `Math.round(x * 10**d) / 10**d`. Affects 2 known values; the correct one matches committed.
4. **Cluster 16 typology** — brief's `Sedimentary & basement` (my default) or committed
   `Sedimentary + basement`?
5. **`serialize`** — confirm `JSON.stringify(value, null, 1)` + `"\n"` is still wanted given
   it reformats both files wholesale (the originals are minified). I will keep it unless you
   say otherwise; the brief's step-4 "whitespace-only diff" expectation just needs dropping.

A verified reference implementation of the corrected reading, plus the comparison harness
that produced every number above, is sitting in my scratchpad at
`…/d6b81a0f-0b0f-4ede-afc8-b83092c6af02/scratchpad/` (`cand.mjs`, `cmp.mjs`,
`explore1..4.mjs`). Nothing from it has been copied into the repo. On an unblock the work is
a straight TDD pass: tests first per brief step 1 plus cases for the three resolved rules,
confirm red, port, confirm green, regenerate, add the byte-for-byte guard against derive's
own output, commit.

---
---

# Task 5 report, part 2 — UNBLOCKED, COMPLETE

All five decisions received and applied. Status: **done**, suite green, three commits.

| Decision | Applied |
| --- | --- |
| 1. Centroid | Mean of per-feature centroids, all levels. |
| 2. Rounding | `Number(x.toFixed(d))`. |
| 3. `sig` / `persist` | Reproduce committed: count all three levels. Comments at both call sites, named pinning test. |
| 4. Mojibake | No repair step, no mojibake test. Assertion dropped. |
| 5. `serialize` | `JSON.stringify(value, null, 1)` + `"\n"`, wholesale reformat accepted. |

## TDD sequence actually followed

1. Wrote `scripts/lib/derive.test.mjs` (21 tests) first.
2. Ran `npm test` — **confirmed red for the right reason**:
   `Error: Cannot find module './derive.mjs' imported from .../derive.test.mjs`,
   1 suite failed, the pre-existing 25 still passing.
3. Implemented `scripts/lib/derive.mjs` and the `scripts/derive.mjs` CLI.
4. Ran `npm test` — 45/45 green (20 derive tests at that point; the guard came later).
5. Ran the ruling-5 value gate (below), then `npm run derive`, then committed.
6. Added the byte-for-byte guard, re-ran — 46/46 green, committed.

## Ruling 5 step 2 — final value-level comparison

Run with the real `scripts/lib/derive.mjs` against the originals as committed at `06bba81`,
field-by-field, keyed on `city` / `id`, numbers within 1e-9, strings and arrays exact,
`typology` excepted:

```
### cities: committed 55, derived 55
ALL VALUES MATCH

### clusters: committed 16, derived 16
ALL VALUES MATCH

TOTAL DIFFS 0
order match cities: true
order match clusters: true
```

Re-verified **after** writing the files, by parsing both written files and diffing them
against `git show 06bba81:data/…` per field:

```
cities:   55 -> 55 rows; value differences: NONE
clusters: 16 -> 16 rows; value differences (1):
  id 16.typology: "Cropland · 101–500 m · Sedimentary + basement"
                → "Cropland · 101–500 m · Sedimentary & basement"
```

So across 55 × 25 city fields and 16 × 17 cluster fields, **exactly one field changed**, and
it is the intended one.

### The one intended change, called out for review

`clusters.json` cluster 16 `typology`: `Sedimentary + basement` → `Sedimentary & basement`.
Source `geology_class` is `Sedimentary & basement formation`; the spec abbreviation table
maps it to `Sedimentary & basement`. The old `+` came from the unknown original producer.
The other 15 typology strings are byte-identical to the originals. No number moved.

## `git diff --stat data/`

Against the pre-task state (`06bba81`, i.e. the content as it stood before this task touched it):

```
 data/cities.json   | 1488 +++++++++++++++++++++++++++++++++++++++++++++++++++-
 data/clusters.json |  378 ++++++++++++-
 2 files changed, 1864 insertions(+), 2 deletions(-)
```

The 2 deletions are the two original single-line minified files; the insertions are the same
data indented one space per level. This wholesale reformat is expected per decision 5 and is
not a value change — see the per-field verification above. The working tree is clean of
`data/` changes at `07b0580`; `git diff --stat data/` against HEAD is empty.

Encoding verified on both written files: no BOM, no CR anywhere, trailing LF present,
byte-exact UTF-8 round-trip, no mojibake sequences.

## Guard verified by mutation, not just by passing

A guard that cannot fail is worthless, so I broke the rules deliberately and confirmed red:

| Mutation | Result |
| --- | --- |
| `sig` → `l50.filter(...)` | 2 failed: the named `sig`/`persist` pin **and** the byte-for-byte guard |
| `round` → `Math.round(x * 10 ** d) / 10 ** d` | 2 failed: `rounds on the exact value…` **and** the guard |

Both restored; 46/46 green afterwards. A future reader who "corrects" `sig`/`persist` to
L50-only gets a red test whose name states the reason, plus the call-site comments.

## Final state

- Suite: **46 passed / 46**, 5 files. Was 25/25; this task added 21.
- Commits:
  - `06bba812d348ec8f5bb771323339d6c75db4190d` — chore: move `data/` to repo root, repoint prototype paths
  - `938039c241cdc40b3390e479a9cbe4f753908639` — feat: derive cities and clusters from spots.geojson
  - `07b0580f1cec8560f815a086c8527b583a106c77` — test: guard derive's JSON output byte for byte
- Files created: `scripts/lib/derive.mjs`, `scripts/lib/derive.test.mjs`, `scripts/derive.mjs`.
  Modified: `data/cities.json`, `data/clusters.json`, `project/nigeria-suhi-dashboard.html`.
- `npm run derive` was already wired in `package.json`; no dependency added, ESM only.

## Null handling (noted per your request)

26 features carry a null `population` — **all** in L75/L90, so the L50-only sums never see
one and `pop_hot`/`pop_cold` are unaffected. 2 features carry null `mean_lst` and 2 null
`max_lst` (`bida_nh_T1_001`, `port_harcourt_nh_T1_002`); those do fall inside the
all-levels means and max, where a naive reduce would have emitted `NaN` into Bida's and Port
Harcourt's rows. Aggregation filters to finite numbers, means divide by the surviving count,
and an all-null group yields `null` rather than `NaN`. Three tests cover this, including a
scan of the whole output for `NaN`/`null` tokens. Both cities verified finite.

## Concerns

1. **`sig` and `persist` remain inflated ~3× by the nesting.** Reproduced on your ruling and
   now well documented, but they are not comparable to any other count in the tables. If the
   dashboard ever labels them "significant spots" or "persistent events", the label will be
   wrong by a factor of three. Suggest the UI copy says so, or shows them divided by 3.
2. **Uncommitted spec edit in the working tree.** `docs/superpowers/specs/2026-10-13-suhi-dashboard-design-system-design.md`
   is modified — presumably your §2 exception and ruling-6 retraction. I left it alone rather
   than commit someone else's edit. It needs committing before the branch is finished.
3. **Task 8 still owes the `project/design_handoff_suhi_dashboard/data/` removal**, left
   untouched as instructed. Note it is now a second, stale copy of `cities.json` and
   `clusters.json` that the guard does not cover, so it still holds the old `+` typology.
4. **The brief's step 4 expectation is obsolete** ("cities.json unchanged or whitespace-only;
   clusters.json changes only in the 16 typology strings"). Superseded by decision 5 and by
   there being no mojibake. Worth correcting in the plan so a later reader does not treat the
   1864-line diff as a failure.

---
---

# Task 5 report, part 3 — review follow-up, COMPLETE

All five findings addressed. **No aggregation behaviour changed**: `data/` is byte-identical,
every number is as reviewed. Two commits: `ad17fcd` and `46f32f6`.

I independently reproduced each finding's factual claim before changing anything; all five
checked out exactly as stated. The verification output:

```
spots: 185 | spots where suhii/slope/hotdays vary across levels: 0
level-multiplicity distribution: {"1":53,"2":8,"3":124}
spots where mean_lst varies across levels: 132
F5: cities where max(L50)===max(all): 55 of 55

F1: cities whose suhii would change if de-duplicated: 30 of 55
  Akure:   1.6  -> 1.19
  Oshogbo: 1.43 -> 1.82
  Calabar: 1.83 -> 1.49
  top10 as published:   Ibadan, Ife, Benin City, Calabar, Uyo, Ijebu-Ode, Ilesa, Ondo, Lagos, Akure
  top10 de-duplicated:  Ibadan, Ife, Benin City, Oshogbo, Ondo, Lagos, Ilesa, Uyo, Ijebu-Ode, Calabar
F2: modal ties across all 55 cities x 5 class fields: 0
F4: TypeError: Cannot read properties of null (reading 'toFixed')
```

## Finding 1 — multiplicity-weighted means (Important)

Confirmed: `suhii`, `slope`, `hotdays` are constant within a spot (0 of 185 vary), spots
carry 1/2/3 levels (53/8/124), so the all-levels mean weights a 3-level spot 3x. Behaviour
**kept**; documentation brought to ruling 16's standard.

- Call-site comment names the three fields, states they are per-spot constants replicated
  across levels, that the mean is therefore multiplicity-weighted, that de-duplicating moves
  `suhii` for 30/55 cities and reorders the top-10 ranking (Calabar #4 to #10, Akure out,
  Oshogbo in), and that it is kept for fidelity to published figures.
- Header comment at L7-8 **corrected**. The old rationale ("those are per-spot measurements
  rather than extents") was backwards: being a per-spot constant is precisely the reason
  *not* to average replicated rows. The header now states per field why the scope is what it
  is, and separates `mean_lst` — which genuinely varies per level in 132 of 185 spots — from
  the three constants it had been wrongly grouped with. That conflation was the root of the
  inverted rationale, so `mean_lst` also got its own pinning test.
- Pinning test: `weights suhii/slope/hotdays means by level multiplicity (deliberate:
  matches published figures, see spec §2)`. It asserts the constancy, the published values,
  the de-duplicated values they would become, and the ranking change.

## Finding 2 — modal tie-break and scope (Important)

Confirmed zero ties in the real data. Added a `modal tie-break` describe with four synthetic
cases (first-occurrence on a 1-1 tie, order-reversal giving the reversed answer, strict
majority regardless of order, three-way tie, null/undefined/empty handling). `modal` is now
exported solely for that test, with a comment saying the strict `n > bestCount` *is* the
tie-break and that `>=` would silently flip it.

**Correction to the finding, which you have since confirmed:** of the three mutants listed,
only two are real.

| Mutant | Verdict |
| --- | --- |
| `n >= bestCount` (last-occurrence) | real gap — now **caught by 2 tests** |
| `modal(l50, …)` (narrowed scope) | real gap — now **caught by 1 test** |
| `sort((a,b)=>b[1]-a[1])` (count-sort) | **equivalent code, not a gap** |

`Array.prototype.sort` is required to be stable, so sorting by count descending and taking
the first maximal entry preserves first-occurrence among ties — the same answer the strict
scan gives. Demonstrated:

```
stable sort on a 1-1 tie keeps order: ["Grassland","Cropland"]
=> first-occurrence preserved, so that mutant is EQUIVALENT code, not a defect
```

An equivalent mutant surviving is correct behaviour for a test suite, not a hole, so I did
not try to kill it. Recording the reasoning here so nobody later adds a test that pins an
implementation detail rather than a behaviour.

The scope mutant needed its own fix, because it is undetectable from the corpus:

```
L50-scope vs all-scope modal disagreements in real data: 0
=> genuinely untestable from the corpus; needs a synthetic case
```

Hence the `Scopeville` synthetic collection (commit `46f32f6`): one L50 row of Cropland
against two non-L50 rows of Grassland, so the all-levels rule reports Grassland and a
narrowed rule reports Cropland. Covers `landcover`, `elev`, `geol`, `climate` and the
cluster table.

## Finding 3 — cluster `n` is a third exception (Important)

Confirmed. Call-site comment added, matching the `sig`/`persist` treatment: `n` is a row
count not a spot count, cluster 1 is 12 rows over 6 spots, same nesting inflation, kept for
fidelity. The header's false claim that "the two documented exceptions are `sig` and
`persist`" is corrected to three, with the means flagged as a fourth artifact of the same
cause. The bare `c1.n === 12` assertion became a named test asserting **both** readings
(12 rows, 6 distinct spots, 6 L50 rows) so the 12 explains itself, plus the invariant across
all 16 clusters.

## Finding 4 — the null contract was untrue (Important)

Confirmed `Number(null.toFixed(2))` throws `TypeError`. Chose the pass-through option:
`round` now returns `null` unchanged, so `mean`'s documented "all-null yields null" is
actually true rather than a latent throw at every rounded call site. Cannot fire on current
data and does not move any number — `data/` is byte-identical after the change.

The misaligned test is fixed as you noted: `never produces NaN or null in the output` was
asserting the opposite of the documented behaviour and so could never catch this. It is
renamed `produces no NaN or null for the current data`, with a comment saying it is a
property of today's output and not evidence the contract holds. The contract itself is now
pinned separately by `yields null for an all-null group instead of throwing`, using a
synthetic all-null feature; it also checks that a sum over an all-null field is 0 (summing
nothing is zero) while the finite fields still compute.

## Finding 5 — overclaiming test name (Minor, included)

Confirmed: max over L50 equals max over all levels for all 55 cities, so no test can
distinguish the scopes for `max_lst`. Renamed to `reports max_lst as the hottest reading in
the city`, and the test now also asserts the two scopes are equal, documenting *why* a scope
assertion is impossible here so nobody adds a misleading one later.

## Mutation results

`derive.mjs` was committed before mutating, so each restore is reliable.

```
baseline:                                Tests  55 passed (55)

CAUGHT by 2 :: modal: >= gives last-occurrence
     - modal tie-break > breaks a tie by first occurrence, not last
     - modal tie-break > prefers a strict majority regardless of order
CAUGHT by 1 :: modal: narrowed to L50 scope
     - takes dominant class fields over all levels, not just L50
CAUGHT by 2 :: cluster n -> l50.length
     - counts cluster n over all contour levels, not spots (deliberate: ...)
     - reproduces the committed JSON byte for byte
CAUGHT by 2 :: suhii de-duplicated by spot_id
     - weights suhii/slope/hotdays means by level multiplicity (deliberate: ...)
     - reproduces the committed JSON byte for byte
CAUGHT by 1 :: round: drop null pass-through
     - null handling > yields null for an all-null group instead of throwing
SURVIVED (equivalent code) :: modal: count-sort  -- see Finding 2 above
```

Every real mutant is now killed. Earlier in this round I ran a mutation batch whose results
were worthless: `git checkout -- scripts/lib/derive.mjs` between mutants silently reverted my
own uncommitted source edits, so the "baseline" was the pre-review file and every mutant
looked like it survived. I caught it when the baseline itself showed 4 failures, redid the
edits, and committed before mutating. Worth knowing for anyone else mutation-testing here.

## Final verification

```
$ npm test
 Test Files  5 passed (5)
      Tests  55 passed (55)

$ npm run derive && git diff --stat data/
(empty)

$ git status --short
(clean)
```

55/55 green, up from 46; `data/` byte-identical after re-deriving, so no number moved.

## Final state

- Commits this round:
  - `ad17fcd4ad3cb3225b08112d4685fb401b7234c8` — docs+test: pin the nesting exceptions and the modal tie-break
  - `46f32f6bac73e8d8affb45444c3e98b492e87bbc` — test: pin the modal class scope with a synthetic collection
- Task 5 total: `06bba81`, `938039c`, `07b0580`, `ad17fcd`, `46f32f6`.
- Untouched as instructed: the per-feature centroid, `toFixed` rounding, all-levels
  `sig`/`persist`, the absent mojibake assertion, every number in `data/`, and minors 6-8
  (`all[0]` for `city_area`, sort stability, `bh_significant` truthiness).

## Concerns

1. **Four nesting artifacts now coexist in one file** (`sig`, `persist`, cluster `n`, and the
   `suhii`/`slope`/`hotdays` means), each individually documented. The header lists all four,
   but a reader meeting them one at a time may still not register the pattern. If the spec
   gains a single "nesting artifacts" section, linking each call site to it would be stronger
   than four independent comments.
2. **The `suhii` ranking is the dashboard's headline ordering** and it is multiplicity-
   weighted. Reproducing the published figures is right, but if the UI presents the top-10 as
   "the hottest cities", that ordering is partly an artifact of how many contour levels each
   spot happens to have, not of heat alone. Worth a footnote in the UI — a Task 6/7 concern.
3. **Minor 6 (`all[0].city_area_km2`) is still open** and deferred. It assumes
   `city_area_km2` is constant within a city; nothing checks that. Low risk, but it is the
   same class of silent-corruption-with-no-throw this task exists to prevent.
