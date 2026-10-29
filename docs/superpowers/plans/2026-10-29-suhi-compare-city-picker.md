# Compare City Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Compare tab's wall of 55 city buttons with one searchable combobox whose options are grouped by state, and record the standing approval that makes departing from the prototype legitimate.

**Architecture:** The state comes from a point-in-polygon join that `scripts/lib/derive.mjs` owns, so `cities.json` gains one field and nothing computes it twice. Grouping and filtering are pure functions in their own module. The combobox is hand-rolled on the WAI-ARIA pattern because no installed Radix primitive is filterable, and `Compare` keeps `picked` and the cap exactly where they already live.

**Tech Stack:** React 19, TypeScript 7, Vitest 5, Playwright 1.64, topojson-client 3.1 (already a dependency, used by `src/map/boundaries.ts`).

**Spec:** `docs/superpowers/specs/2026-10-29-suhi-compare-city-picker-design.md`

## Global Constraints

- **The prototype is the fallback, not the authority** (spec §2 / rebuild spec §3.3 once Task 1 lands). Anything this plan does not name still matches `project/nigeria-suhi-dashboard.html`.
- **Every departure is registered** in `tests/fidelity/allowed-diffs.ts` with a `cite` matching `/^spec §/`, naming the approval date 2026-10-29.
- **Every derivation has exactly one owner.** The city-to-state mapping is `derive.mjs`'s; no runtime join.
- **Contrast floor 4.5:1** on every text pair; `npm run audit` must stay at 82/82 with no new row failing.
- **New copy goes in `src/i18n/dictionary.mjs`** with all four languages (`en, ha, ig, yo`), never as a literal at a call site (rebuild spec §10.2 leaves three under native review).
- **The cap is five.** `togglePicked` keeps it; the picker reports, it does not enforce.
- Gates: `npm test`, `npm run audit`, `npm run ink`, `npm run fidelity`, `npm run a11y`, `npm run build`. Playwright suites need `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` on a machine that cannot run `npx playwright install`.

## Review Focus

Five failure modes the spec implies that no task's own deliverable naturally exercises. Each has its test pinned to the task that owns the code.

1. **A query matching a state but no city, and vice versa.** "Borno" must surface Borno's cities even though no city is called Borno; "Gamboru" must surface its city without hiding its state heading. A filter that tests only city names, or only state names, passes every obvious test and fails this. Pinned in Task 3.
2. **A city whose name is a substring of another's.** `Ilorin`/`Lokoja` are safe, but `Oyo` is both a city and its state, and `Ondo` is both. A filter that matches state OR city must not list the same city twice. Pinned in Task 3.
3. **The cap reached while the list is open.** The fifth pick must turn the remaining options non-selectable *in the open list*, not only on reopen, and `Enter` on a disabled option must do nothing. Pinned in Task 4.
4. **Every city removed.** `picked` empty is reachable (remove all five chips) and already renders `<p class="note">—</p>`; the combobox must still be usable and the live region must not announce "0 of 5" as an error. Pinned in Task 4.
5. **A boundary file that leaves a third city unassigned.** `assignState` must never return `undefined`: today exactly two cities fall outside every polygon and go to the nearest state. A future `nga-adm1.topojson` with different precision must fail loudly rather than silently grouping a city under the wrong state. Pinned in Task 2.

---

## Task 1: §3.3 moves into the binding spec

The rebuild spec is the document every later task and session treats as authority, and it currently says "Nothing else." Until that changes, every departure in this plan contradicts it.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-suhi-dashboard-pixel-rebuild-design.md` (§3, after §3.2)
- Modify: `docs/superpowers/specs/2026-10-29-suhi-compare-city-picker-design.md` (§2 becomes a pointer)
- Test: `scripts/spec-amendment.test.mjs` (repo-level invariants live in `scripts/`, beside `data-layout.test.mjs`, not in `docs/`)

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

```js
// scripts/spec-amendment.test.mjs
test('the rebuild spec carries §3.3 and no longer closes §3 with "Nothing else"', …)
test('§3.3 states all three conditions a departure must meet', …)   // approved, specified, registered
test('the picker spec points at §3.3 rather than restating it', …)   // one source of truth
```

Read both files with `readFileSync`. Assert the rebuild spec contains `### 3.3 Approved departures`; that the exact sentence `Nothing else. A change that is not in the second table and not in §9 is out of scope,` is **absent**; that §3.3's text contains all of `approved`, `spec` and `allowed-diffs.ts`; and that the picker spec's §2 contains `§3.3` and does **not** contain `### 3.3 Approved departures` (the heading lives in one file).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/spec-amendment.test.mjs`
Expected: FAIL — `### 3.3 Approved departures` not found.

- [ ] **Step 3: Move the subsection**

Copy §3.3 verbatim from the picker spec §2 into the rebuild spec directly after §3.2. Replace the rebuild spec's "Nothing else…" sentence with: `Departures from this rule are governed by §3.3.` Replace the picker spec's §3.3 body with a pointer to the rebuild spec, keeping §2's surrounding context.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/spec-amendment.test.mjs`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs scripts/spec-amendment.test.mjs
git commit -m "docs: §3.3 — the prototype becomes the fallback, not the authority"
```

---

## Task 2: Every city carries its state

**Files:**
- Modify: `scripts/lib/derive.mjs` (`deriveCities`)
- Modify: `scripts/derive.mjs` (read the boundaries, pass them in)
- Modify: `src/app/data.ts` (`City`)
- Modify: `data/cities.json` (regenerated — never by hand)
- Test: `scripts/lib/derive.test.mjs`

**Interfaces:**
- Produces: `assignState(lon: number, lat: number, states: StateFeature[]): string` — exported from `scripts/lib/derive.mjs`, returns a `shapeName`, never `undefined`.
- Produces: `deriveCities(fc, states)` — second parameter is the ADM1 `FeatureCollection`; each row gains `state: string` immediately after `lat`.
- Produces: `City.state: string` in `src/app/data.ts`.

- [ ] **Step 1: Write the failing tests**

```js
test('assignState puts a city inside a polygon in that state', …)             // Ibadan -> Oyo
test('assignState falls back to the NEAREST state for a city in none', …)     // Oron -> Akwa Ibom, Gamboru -> Borno
test('assignState never returns undefined, for any of the 55 cities', …)      // Review Focus 5
test('deriveCities assigns all 55, across 32 states, 5 states empty', …)
test('exactly two cities use the nearest-state fallback, and they are Oron and Gamboru', …)
```

The counts are the spec's §4.1: 32 states hold at least one city, 18 hold exactly one, 5 hold none, 2 cities are outside every polygon. Name Oron and Gamboru in the assertion, not just the count.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/lib/derive.test.mjs`
Expected: FAIL — `assignState is not a function`.

- [ ] **Step 3: Implement `assignState` and extend `deriveCities`**

Ray-casting point-in-polygon over each feature's rings, honouring holes and `MultiPolygon`; on no hit, the state whose polygon has the least squared distance from the point to any vertex. No new dependency: `topojson-client` converts the topology, and the geometry test is ~20 lines.

- [ ] **Step 4: Read the boundaries in `scripts/derive.mjs` and regenerate**

`feature(topo, topo.objects[<first key>])` as `src/map/boundaries.ts:85-92` already does, then `deriveCities(fc, states)`.

Run: `npm run derive`
Expected: `wrote …/cities.json (55 rows)`, and `git diff --stat data/cities.json` shows only additions of `"state"`.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS — including the existing byte-for-byte guard, which now compares against the regenerated file.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/derive.mjs scripts/derive.mjs scripts/lib/derive.test.mjs src/app/data.ts data/cities.json
git commit -m "feat: every city carries the state its centroid falls in"
```

---

## Task 3: Grouping and filtering, as pure functions

**Files:**
- Create: `src/views/cityGroups.ts`
- Test: `src/views/cityGroups.test.ts`

**Interfaces:**
- Consumes: `City` from Task 2, including `state`.
- Produces:
  ```ts
  export interface CityGroup { readonly state: string; readonly cities: readonly City[] }
  export function groupByState(cities: readonly City[]): CityGroup[]
  export function filterGroups(groups: readonly CityGroup[], query: string): CityGroup[]
  export function fold(s: string): string   // NFD, combining marks stripped, lowercased
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test('groupByState sorts states A-Z and cities A-Z within each', …)
test('groupByState emits no group for a state with no cities', …)        // 32 groups, not 37
test('filterGroups with an empty query returns every group unchanged', …)
test('a query matching a STATE keeps all its cities', …)                 // "Borno" -> Review Focus 1
test('a query matching a CITY keeps that city and its state heading', …) // "Gamboru" -> Review Focus 1
test('a city is never listed twice when its name matches its own state', …) // "Oyo" -> Review Focus 2
test('filtering ignores case and diacritics', …)                          // "ìbàdàn" finds Ibadan
test('a query matching nothing returns an empty array', …)
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/views/cityGroups.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the three functions**

`fold` is `s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`. A group survives when its folded state name contains the folded query, in which case all its cities survive; otherwise only the cities whose folded name contains it. That ordering is what makes Review Focus 2 fall out rather than needing a de-duplication pass.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/views/cityGroups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/cityGroups.ts src/views/cityGroups.test.ts
git commit -m "feat: group cities by state, and filter on either name"
```

---

## Task 4: The combobox

**Files:**
- Create: `src/views/CityPicker.tsx`
- Test: `src/views/CityPicker.test.tsx`
- Modify: `src/i18n/dictionary.mjs` (three keys)
- Modify: `src/styles/app.css` (the listbox's own rules)

**Interfaces:**
- Consumes: `groupByState`, `filterGroups` (Task 3); `City.state` (Task 2).
- Produces:
  ```ts
  export interface CityPickerProps {
    readonly cities: readonly City[];
    readonly picked: readonly string[];
    readonly max: number;
    readonly onToggle: (city: string) => void;
  }
  export function CityPicker(props: CityPickerProps): JSX.Element
  ```

**New dictionary keys**, English first, the other three to the same first-pass standard as their neighbours (§10.2):
- `pick_city` — "Search city or state…" (the input's placeholder and its `aria-label`)
- `pick_max` — "Five cities is the maximum; remove one to add another"
- `pick_none` — "No city or state matches"

- [ ] **Step 1: Write the failing tests**

```tsx
test('renders a combobox with the dictionary placeholder, and no listbox until opened', …)
test('typing filters the options and keeps the state headings', …)
test('picking an option calls onToggle, closes the list and clears the input', …)
test('a picked city renders as a .pk chip with aria-pressed=true, in pick order', …)
test('clicking a chip calls onToggle with that city', …)
test('at the cap, unpicked options carry aria-disabled and the list shows pick_max', …)   // Review Focus 3
test('Enter on a disabled option does nothing', …)                                        // Review Focus 3
test('with nothing picked the combobox still opens and announces 0 of 5', …)              // Review Focus 4
test('ArrowDown/ArrowUp move aria-activedescendant, skipping headings and disabled options', …)
test('Escape closes the list and restores focus to the input', …)
test('a query matching nothing shows pick_none', …)
test('the live region announces a pick and a removal', …)
```

Component suites in this repo open with `// @vitest-environment jsdom`, call `cleanup()` in their own `afterEach`, and drive interaction with `userEvent`, not `fireEvent` — see `src/app/App.test.tsx`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/views/CityPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CityPicker`**

`<input role="combobox">` with `aria-expanded`, `aria-controls`, `aria-activedescendant` and `className="search"`; `<ul role="listbox">` of `<li role="group">` each with `aria-label` and nested `<li role="option" id=…>`; chips as `<button className="pk" aria-pressed="true">`; one `className="sr-only"` `aria-live="polite"` region, as `#drawerLive` and `#tabLive` already do.

The component owns the query, the open flag and the active index. It owns no selection: `picked` and `onToggle` are props.

- [ ] **Step 4: Style the listbox**

New rules only for what has no counterpart: the listbox's position, its max-height and scroll, the group heading, and the active/disabled option states. `.search` and `.pk` are reused unchanged.

Run: `npm run audit`
Expected: `All 82 pairs pass` — any new text colour must come from an audited token.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/views/CityPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/CityPicker.tsx src/views/CityPicker.test.tsx src/i18n/dictionary.mjs src/styles/app.css
git commit -m "feat: a searchable city combobox, grouped by state"
```

---

## Task 5: Wire it into Compare, and register the departure

**Files:**
- Modify: `src/views/Compare.tsx:101-113` (the `.picker` block)
- Modify: `tests/fidelity/allowed-diffs.ts`
- Modify: `src/views/Compare.test.tsx`
- Modify: `tests/a11y.spec.ts` (the roving-group inventory)

**Interfaces:**
- Consumes: `CityPicker` (Task 4). `picked`, `togglePicked` and `DEFAULT_PICKED` stay exactly as they are.

- [ ] **Step 1: Write the failing tests**

```tsx
// Compare.test.tsx
test('the 55-button wall is gone: .pk counts the PICKED cities, not every city', …)
test('picking from the combobox adds a card; removing a chip removes it', …)
test('the cap still holds at five through togglePicked', …)
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/views/Compare.test.tsx`
Expected: FAIL — 55 `.pk` elements found, 4 expected.

- [ ] **Step 3: Replace the picker block**

`#cmpPicker` keeps its id and class and now holds `<CityPicker>` plus the chip row.

- [ ] **Step 4: Register the departure**

Add to `ALLOWED_DIFFS`, in a `FROM_SPEC_3_3` block whose comment names the 2026-10-29 approval and the picker spec:

| Target | Property | Counts | Cite |
| --- | --- | --- | --- |
| `#panel-compare .pk` | `count` | `[55, 4]` | `spec §3.3` |
| `#panel-compare .picker` | `box` | — | `spec §3.3` |

- [ ] **Step 5: Run every gate**

Run: `npm test && npm run audit && npm run ink && npx tsc --noEmit -p tsconfig.json && npm run build`
Then: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run fidelity && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run a11y`
Expected: all green; fidelity reports zero diffs outside `ALLOWED_DIFFS`; axe clean on Compare in both themes; the Tab sweep picks up the combobox and the chips from their control roles with no edit, and the roving-group inventory in `tests/a11y.spec.ts` is updated only if the listbox registers as one.

- [ ] **Step 6: Screenshot both themes and look at them**

The repository's own rule: automated checks prove a thing is correct, they cannot show whether it is there. Capture the Compare tab in Nocturne and Modernist, list open and closed.

- [ ] **Step 7: Commit**

```bash
git add src/views tests/fidelity/allowed-diffs.ts tests/a11y.spec.ts shot-*.png
git commit -m "feat: Compare picks cities from a searchable list, not a wall of 55"
```

---

## Self-review

**Spec coverage.** §2 amendment → Task 1. §3 behaviour table → Tasks 3 and 4. §3.1 the cap and its message → Task 4. §4 the state field, §4.1 counts, Oron and Gamboru → Task 2. §4.2 the `City` type and the byte-for-byte guard → Task 2. §5 component and props → Task 4. §5.1 filtering → Task 3. §6 markup and reuse → Tasks 4 and 5. §6.1 the two `ALLOWED_DIFFS` entries → Task 5. §7 accessibility → Task 4, verified in Task 5. §8 testing → each task's own steps. §9.1 and §9.2 are non-goals and have no task, correctly.

**Type consistency.** `City.state` is produced in Task 2 and consumed by name in Tasks 3 and 4. `CityGroup`, `groupByState`, `filterGroups` and `fold` are produced in Task 3 and consumed in Task 4. `CityPickerProps` is produced in Task 4 and consumed in Task 5. `togglePicked` and `DEFAULT_PICKED` are existing exports and are not redefined.

**Review Focus coverage.** 1 and 2 in Task 3, 3 and 4 in Task 4, 5 in Task 2.

**Proportion.** Five tasks over a 277-line spec, with signatures and test names rather than function bodies. The only verbatim content is three dictionary strings, which are copy, and two exemption rows, which are a contract.

**One ordering constraint.** Task 2 must precede Task 3: `groupByState` cannot be tested without `City.state` on the fixtures. Tasks 3 and 4 could be merged, but the filter is where Review Focus 1 and 2 live and it is worth a reviewer's gate of its own.
