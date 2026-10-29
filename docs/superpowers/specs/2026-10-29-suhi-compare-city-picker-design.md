# Compare's city picker — searchable, grouped by state

**Date:** 2026-10-29
**Status:** approved in conversation 2026-10-29; written for review
**Supersedes nothing. Amends** `2026-10-14-suhi-dashboard-pixel-rebuild-design.md` §3.

---

## 1 · Context

The Compare tab picks cities from a wall of 55 `.pk` buttons, transcribed from
`project/nigeria-suhi-dashboard.html` line 1072. On a 1440px screen that is four wrapped rows
of pills with no order a reader can predict — the cities are in `cities.json` order, which is
the order `derive.mjs` grouped them, which is the order they appear in the source GeoJSON.
Finding Gombe means reading 55 labels.

The user asked for a searchable dropdown, and for the states to be a way in: *type "Kano" and
you get the state and its cities; type "Ibadan" and you get the city*.

**This is the first sanctioned departure from the prototype**, and the user granted a standing
approval for further ones on 2026-10-29. §2 records what that changes about the governing rule,
because it changes more than this one component.

### Audiences

Unchanged from the rebuild spec §1. The picker matters most to the two audiences who arrive
knowing which place they care about — a state ministry officer and a city planner — and who
currently have to find it by eye.

---

## 2 · The amendment to §3

The rebuild spec's §3 reads, after its table of four sanctioned changes:

> Nothing else. A change that is not in the second table and not in §9 is out of scope,
> however much it would improve the design.

**That sentence no longer stands alone.** §3.3 below replaces it.

**Where this text lives.** The rebuild spec is the binding document, so §3.3 belongs in it. The
implementation plan's first step copies the subsection below into
`2026-10-14-suhi-dashboard-pixel-rebuild-design.md` verbatim, directly after §3.2, and replaces
the "Nothing else" sentence with a pointer to it. Until that step lands, this document is the
record of the amendment. There is no second version: the text moves, it is not duplicated.

### 3.3 Approved departures

From 2026-10-29 the prototype is the **starting point and the fallback**, not an absolute
authority. A change that departs from it is permitted when all three hold:

1. **The user approved it**, in writing, identifiably. An approval covers what it names; it is
   not a licence for adjacent changes.
2. **It is recorded in a spec**, with the reasoning and the measured cost — this document is the
   first.
3. **It is registered in `tests/fidelity/allowed-diffs.ts`** with a citation, exactly as every
   other sanctioned difference is.

Everything the user has not approved still defaults to the prototype. "The original wins" remains
the rule for anything unspecified, and a departure invented during implementation is still a
defect, not a decision.

**The fidelity guard stays, and its job is unchanged.** It was never there to prevent change; it
is there to make change *deliberate*, by failing on any difference nobody registered. A relaxed
authority makes the guard more useful, not less: with the prototype no longer absolute, the
register in `allowed-diffs.ts` becomes the only complete account of how the shipped page differs
from the approved one.

**Citations for a departure read `spec §3.3`**, plus the approval date and this document. That
keeps `tests/fidelity/fidelity.spec.ts`'s existing rule — every entry's `cite` matches
`/^spec §/` — true without changing the test.

**What this does not change:** §4's token blocks, §5's ink derivation, §6's encoding, and the
§9.2 build guards all stand. A departure is a change to the *design*, never a licence to skip
the contrast audit, the ink derivation or the byte-for-byte data guard.

---

## 3 · What the picker does

One combobox replaces the wall. Below it, the cities already picked appear as chips.

| | |
| --- | --- |
| **Typing** | filters on city name **and** state name. "Kano" matches the state and its cities; "Ibadan" matches the city; "Ij" matches Ijebu-Ode |
| **Grouping** | options are grouped under their state, states A–Z, cities A–Z within each |
| **Picking** | selects the city, **closes** the list and clears the input, leaving focus in the input so the next search is one keystroke away |
| **Chips** | one `.pk` per picked city, in pick order; clicking a chip removes it |
| **Cap** | five, as the prototype caps it. At five, unpicked options are not selectable and the list says why |
| **Empty** | "No city or state matches *<query>*" when nothing matches |

**The state is a way to find cities and nothing else.** It is not a unit of comparison, and §9.1
records the measurement behind that decision.

### 3.1 The cap, and the one behaviour that changes

The prototype caps at five by doing nothing at all on the sixth click (line 1076 — an unpicked
city is added *only* while `picked.length < 5`). A control that silently ignores a click is a
defect of the same family as §9.1's dead Download buttons: a promise the UI makes and does not
keep.

Under §3.3 this is fixed rather than transcribed. At five picks, unpicked options carry
`aria-disabled="true"` and the listbox shows a single line — "Five cities is the maximum; remove
one to add another" — in the dictionary, in all four languages. The cap itself is unchanged.

---

## 4 · The state mapping

No city record carries a state. `cities.json` has `city, lon, lat` and 22 measures; the 37 ADM1
boundaries exist as geometry only, added for the map layer in Task 12.

**The join belongs to `derive.mjs`**, which owns every published figure. `deriveCities` gains one
field, `state`, assigned by point-in-polygon against
`data/boundaries/nga-adm1.topojson` (geoBoundaries gbOpen ADM1, ODC-ODbL 2025-08-26) using each
city's existing derived centroid. A runtime join in the browser was rejected: it would put a
second definition of "which state is this city in" next to the one `derive.mjs` owns, and the
load-bearing rule of this codebase is that every derivation has exactly one owner.

### 4.1 What the join produces, measured

| | |
| --- | --- |
| States holding at least one of the 55 cities | **32 of 37** |
| States holding exactly one city | **18** |
| States holding none | 5 — they never appear in the picker |
| Cities inside no polygon | **2** |

The two are **Oron** (8.3004, 4.8265), which sits in the Cross River estuary, and **Gamboru**
(14.2301, 12.3849), on the Cameroon border. Both are artefacts of boundary precision at a
coastline and a border, not real gaps.

**They are assigned to the nearest state polygon** — Akwa Ibom and Borno — so the mapping is
total and every city appears in the picker exactly once. A test names both by name: if a future
boundary file resolves them differently, or leaves a third city outside, that is a change to the
published figures and it fails loudly rather than quietly moving a city to another group.

### 4.2 What follows from adding a field

`data/cities.json` is regenerated, which the existing byte-for-byte guard
(`scripts/lib/derive.test.mjs`, "serialize") enforces by comparing `deriveCities` output against
the committed file. The `City` interface in `src/app/data.ts` gains `state: string`. Nothing else
reads it: the table, the map, the drawer and the reports are untouched.

---

## 5 · Component

`src/views/CityPicker.tsx`, one file, used only by `Compare`.

```ts
export interface CityPickerProps {
  readonly cities: readonly City[];      // all 55, in cities.json order
  readonly picked: readonly string[];    // city names, in pick order
  readonly max: number;                  // 5
  readonly onToggle: (city: string) => void;
}
```

`Compare` keeps `picked` and `togglePicked` exactly as they are — local state, as the prototype
scoped it, and the cap lives in `togglePicked` where it already lives. The picker renders and
reports; it owns no selection state of its own.

**Hand-rolled against the WAI-ARIA combobox pattern**, not Radix. `@radix-ui/react-select` is not
filterable, and putting a text input inside its content fights its own typeahead and focus
management. This repo already chose native and hand-rolled controls over Radix twice for
comparable reasons — `#cluster` is a native `<select>` and both sliders are native
`<input type="range">` — and since Task 12 there is an accessibility suite in a real browser to
hold the result.

Structure: an `<input role="combobox">` with `aria-expanded`, `aria-controls` and
`aria-activedescendant`; a `<ul role="listbox">` of `<li role="option">` grouped by
`<li role="group">` with `aria-label`; the chips as `<button class="pk" aria-pressed="true">`.

### 5.1 Filtering

Case-insensitive and diacritic-insensitive, via `String.prototype.normalize('NFD')` with
combining marks stripped — the same treatment the dictionary's diacritic fixture already assumes
for Hausa, Igbo and Yorùbá. A query matches a city when it is a substring of the city name **or**
of its state's name; a state group is shown when its name matches or any of its cities do.

---

## 6 · Markup, styling and the guard

`.picker` stays as the container id `#cmpPicker`, so its place in the panel is unchanged. It now
holds the combobox and the chip row instead of 55 buttons.

`.pk` is reused verbatim for the chips — same border, radius, padding, font-size, and the
`[aria-pressed=true]` treatment that Task 12 moved to `--accent-ink`. No new colour token, and no
change to any existing rule. The combobox's own rules reuse `.search`'s input treatment, which is
what `#cluster` and `#search` already use.

### 6.1 `ALLOWED_DIFFS` entries this adds

| Target | Property | Counts | Cite |
| --- | --- | --- | --- |
| `#panel-compare .pk` | `count` | `[55, 4]` | `spec §3.3` — 55 pills became the chips for what is picked |
| `#panel-compare .picker` | `box` | — | `spec §3.3` — the container's height follows one input plus a chip row, not four wrapped rows |

`[55, 4]` is exact and measured at first paint, which is where the guard measures: the original
renders one `.pk` per city, and the rebuild renders one per PICKED city, which `DEFAULT_PICKED`
makes four. The listbox's options are `<li role="option">` and carry no `.pk` class, so they do
not enter this count. Each entry carries the approval date and points at this document, per §2.

---

## 7 · Accessibility

The combobox is the first control in this app that is neither native nor Radix-supplied, so it
carries the burden itself:

- **Keyboard:** `ArrowDown`/`ArrowUp` move the active option (wrapping, skipping group headings
  and disabled options), `Enter` picks it, `Escape` closes and restores the input, `Home`/`End`
  jump, `Tab` leaves. Chips are in the tab order and removable with `Enter` or `Space`.
- **Screen reader:** the active option is announced through `aria-activedescendant`; a polite
  live region announces what was picked or removed and how many of five are used, reusing the
  pattern `#drawerLive` and `#tabLive` already follow.
- **Held by the existing suites:** `tests/a11y.spec.ts`'s Tab sweep is derived from control role,
  so the combobox and every chip enter the inventory automatically; axe already runs on the
  Compare tab in both themes.

---

## 8 · Testing

| What | Where |
| --- | --- |
| The join: 55 cities to states, the counts in §4.1, and Oron and Gamboru by name | `scripts/lib/derive.test.mjs` |
| `cities.json` byte-for-byte after the new field | existing "serialize" guard |
| Filter by city, by state, diacritic-insensitively; empty state; grouping and sort order | `src/views/CityPicker.test.tsx` |
| Cap: the fifth pick, the sixth option's `aria-disabled`, the message | same |
| Chip removal, pick order, the live region's text | same |
| Keyboard: arrows, Enter, Escape, Home/End, chips | same, plus the a11y sweep |
| The guard stays green with the two new entries | `npm run fidelity` |

---

## 9 · Open items and non-goals

### 9.1 Not built — state-level comparison

The user's first phrasing asked to "compare state". The data cannot support it honestly: of the
32 states holding cities, **18 hold exactly one**, so for more than half of them a state
comparison would be a single city under another name. Real state aggregates would need
`derive.mjs` to pool cities per state, and §10.2 of the rebuild spec records that city-total
population does not exist — so the aggregates would be partial in a way the city figures are not.

Decided 2026-10-29: the state is a search and grouping key only. Revisit if city-total population
arrives.

### 9.2 Open — picks are not in the URL

`picked` is local component state, as the prototype scoped it, so §8.4's deep links cannot carry
a comparison. Now that departures are allowed this is worth doing — a shared link to "these four
cities" is exactly what the audiences in §1 would send each other — but it is a change to the
deep-link vocabulary and belongs in its own approval.

### 9.3 Non-goals

Nothing outside the Compare tab's picker. The table's city column, the map's city circles, the
drawer and the reports are untouched, and no existing token, ramp or audited pair moves.

---

## 10 · Decision log

| # | Decision | Why | Cost if wrong |
| --- | --- | --- | --- |
| 1 | The prototype becomes the fallback, not the authority (§2) | the user's standing approval, 2026-10-29 | the register in `allowed-diffs.ts` becomes the only complete account of what differs; if it rots, nothing else knows |
| 2 | State is a search key, not a unit of comparison | 18 of 32 states hold one city | a reader may expect state figures and not find them; §9.1 says so in the spec |
| 3 | The join lives in `derive.mjs`, not the browser | one owner per derivation | a second definition of city-to-state would eventually disagree with the first |
| 4 | Oron and Gamboru go to the nearest state | both are boundary-precision artefacts at a coast and a border | two cities appear under a state a reader might not expect; a test names them |
| 5 | Hand-rolled combobox, not Radix | Select is not filterable; the repo has two precedents | more code to own, and the a11y burden is ours — held by the suite from Task 12 |
| 6 | The silent sixth click is fixed, not transcribed | a control that ignores a click is §9.1's dead-button family | a reader who wanted silent behaviour loses it |
| 7 | `.pk` and `.picker` are reused rather than restyled | the chips are the same object as the old pills | none measured; the guard holds both boxes |
| 8 | Picking closes the list rather than keeping it open for the next pick | a dropdown that stays open after a choice is a multi-select, which is not what was asked for, and the input stays focused so reopening costs one keystroke | picking five cities costs five extra keystrokes; revisit if that annoys in use |
