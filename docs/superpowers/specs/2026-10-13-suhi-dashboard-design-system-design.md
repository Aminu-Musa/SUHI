# Nigeria SUHI dashboard — design system and prototype rebuild

**Date:** 2026-10-13
**Status:** SUPERSEDED by `2026-10-14-suhi-dashboard-pixel-rebuild-design.md`

> The design in sections 3, 4, 5 and 7 of this document was abandoned on 2026-10-14
> in favour of a pixel-for-pixel rebuild of the original prototype. It is kept for the
> record, and because sections 2.1, 6, 9.1 and 10 carried forward. Revision 2's section
> 11 lists every reversal.
**Supersedes:** the visual direction in `project/design_handoff_suhi_dashboard/README.md`
(Nocturne and Modernist as two independent design systems)

---

## 1 · Context

A public dashboard for a 2024 study of surface urban heat islands across 55 Nigerian
cities. Getis-Ord Gi\* on MODIS land surface temperature produced 441 contour polygons —
places measurably hotter than their rural surroundings and places measurably cooler — at
three nesting percentiles (L50, L75, L90), for two acquisitions (day, night).

An HTML/CSS/JS prototype exists and works. It is deployable as-is. This document
specifies a redesign of its visual system and a rebuild of its map engine.

### Audiences

| Audience | Wants |
| --- | --- |
| Ministry and state officials | The ranking and the population count |
| Public-health and field teams | To find a specific place and read its numbers |
| Researchers | Attributes, p-values, Sen slopes, which contour level |
| Donors and NGOs | A one-page brief to attach to a memo |

Four of five read this on a phone or a projector, not a GIS workstation.

### Why redesign

The existing design is coherent but has three structural problems, all verified against
the running prototype and its data files:

1. **The colour encoding is uninformative.** `suhii`'s sign agrees with a spot's
   hot/cold class only **53.5%** of the time (236/441) — a coin flip. The variable
   driving every polygon's colour is statistically unrelated to what the polygon is.
2. **Nocturne's data ramps are inverted.** On a dark ground salience comes from
   luminance, and today the mildest hot spots sit at 11.1:1 while the most severe sit at
   2.8:1. Severe cold spots sit at 1.45:1 — effectively invisible.
3. **Two independent design systems doubled the surface and halved the rigour.** Seven
   text/ground pairs fail WCAG AA in the shipping prototype, and ten `--ui-*` aliases
   live in the page's style block because neither system had a surface layer.

---

## 2 · Brief

**Priority:** clarity for non-experts. An official or field officer gets the finding
fast; researcher detail lives one layer down.

**Constraints**

- No external brand to honour. The identity is the study's own.
- Nocturne (dark) and Modernist (light) keep their names and roles but become **two
  grounds of one system** — shared type, spacing, components. Switching theme changes
  brightness, never layout.
- Design around laptop/desktop first.
- Four languages: English, Hausa, Igbo, Yorùbá.
- Deploys to Cloudflare Pages as a static site.

**Success criteria**

1. Every text-on-ground pair clears 4.5:1 (3:1 for large text) in **both** grounds,
   measured not eyeballed.
2. A non-expert can state the national finding within ten seconds of load.
3. One component set serves both grounds.
4. All four languages render with diacritics intact at every size in the scale.
5. Usable at 390px — degraded in density, not in meaning.

**Scope.** Same four views, same 441 spots / 55 cities, same four languages. This is a
redesign of the look, the information architecture and the map engine — not new
analysis.

**Preserved from the original handoff, non-negotiable:**

- Counts, areas and populations aggregate **L50 only**. L75 and L90 nest inside L50;
  summing all three triple-counts.
- **Four nesting artifacts are reproduced deliberately** — see §2.1.

### 2.1 Nesting artifacts in the published figures

L75 and L90 contours nest **inside** L50, so a spot appears as 1, 2 or 3 rows
(53 / 8 / 124 spots respectively). Four derived fields aggregate over all rows rather
than L50 only. All four were confirmed against the committed data on 2026-10-13 and are
**reproduced on the study author's explicit decision**, so the dashboard keeps matching
the published figures. Each has a call-site comment and a test whose name states the
reason; a future reader who "corrects" one gets a red test with an explanation.

| Field | Artifact | Effect |
| --- | --- | --- |
| `sig` (cities) | BH-significant count over all levels | inflated ~3× |
| `persist` (cities) | persistent day+night count over all levels | inflated ~3× |
| `n` (clusters) | row count, not spot count — cluster 1 is 12 rows from 6 spots | inflated ~2× |
| `suhii`, `slope`, `hotdays` (cities) | **multiplicity-weighted means** | see below |

The last is the consequential one. Those three fields are **constant within a spot**
(0 of 185 vary across levels), so averaging across all rows weights a 3-level spot 3× a
1-level spot. It changes the displayed value for **30 of 55 cities** (Akure 1.60 → 1.19,
Oshogbo 1.43 → 1.82, Calabar 1.83 → 1.49) and, because the table sorts by `suhii`,
**changes the top-10 ranking's membership and order** — Calabar #4 → #10, Akure out,
Oshogbo in.

`mean_lst` is *not* an artifact: it genuinely varies per level (132 of 185 spots), so
averaging all rows is correct. `max_lst` is immune, since L90 ⊂ L75 ⊂ L50 makes the max
identical under either scope.

**Consequences for the UI.** No view may describe `sig`, `persist` or cluster `n` as a
count of distinct spots. The city ranking by `suhii` is the dashboard's headline
ordering and is multiplicity-weighted, so any copy calling it "hottest cities" needs a
footnote. If the published figures are ever revised, this section is the first thing to
correct — switching all four to L50-only is a one-line change per call site.
- Proportional circles use **one shared sqrt scale** across hot and cold.
- The year slider back-casts from each spot's Sen slope and **says so in the control**.
- BH significance is **shown, not filtered**.
- Basemap attribution strings are required by the tile terms of use.

---

## 3 · Visual direction — "Field"

Signage-grade. Clarity by boldness: large figures, heavy weights, maximum contrast,
built to survive daylight and the back of a room. Chosen over an achromatic
"Instrument" direction and a publication-style "Briefing" direction, with one element
borrowed from the latter (§7.1, the headline sentence).

---

## 4 · Foundations

### 4.1 Type — Archivo

One variable family with a width axis, so display sizes can go slightly expanded
without a second face. Already present in the existing Modernist sheet, so its Yorùbá
and Igbo coverage is known rather than assumed.

| Role | Size | Weight | Tracking | Notes |
| --- | --- | --- | --- | --- |
| `display` | 34px | 800 | −0.03em | The headline sentence; line-height 1.1 |
| `figure` | 40px | 800 | −0.03em | KPI values; `tabular-nums`; line-height 1.1 |
| `title` | 22px | 700 | −0.015em | Page and drawer titles; line-height 1.2 |
| `section` | 13px | 700 | +0.07em, caps | Rail section headings; line-height 1.3 |
| `body` | 14px | 400 | — | line-height 1.6 |
| `label` | 12px | 600 | +0.07em, caps | **Floor for anything a non-expert reads**; line-height 1.3 |

**Hard floor: 11px. Nothing below 11px ships.** The current prototype uses 8px KPI
labels, 9px brief captions and 9.5px notes; this is the single largest change in the
system and the one most directly serving the brief.

**Typeface gate.** Yorùbá combines dot-below vowels with tone marks (ẹ́, ọ̀, ṣ) and Igbo
needs ị, ụ, ṅ. Any typeface change must be tested against real strings in all four
languages **before** adoption. Archivo passes; this was verified in the browser across
the full scale.

### 4.2 Spacing

One 4px scale, replacing Nocturne's `2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4` and
Modernist's `4 / 8 / 12 / 16 / 24 / 32`:

```
--space-1: 4px   --space-2: 8px   --space-3: 12px   --space-4: 16px
--space-6: 24px  --space-8: 32px  --space-12: 48px
```

**Density** is an attribute on `<html>`, working exactly as `data-theme` does:

| `data-density` | Multiplier | Use |
| --- | --- | --- |
| `compact` | 0.85× | Research table |
| `default` | 1× | Desktop |
| `touch` | 1.15× | Phone; adds a 44px minimum hit target |

This is what keeps the mobile layout (§7.8) a density change rather than a rewrite.

### 4.3 Radius and rules

```
--radius-sm: 0px   --radius-md: 2px   --radius-lg: 4px     /* "Sharp" */
--rule: 1px          /* table rows, panel edges, control borders */
--rule-strong: 2px   /* major section dividers, map frame, header underline */
```

Rule weight encodes **hierarchy** and is identical in both grounds. This replaces the
single `--ui-rule` that is 1px in Nocturne and 2px in Modernist today, where switching
theme silently changes what a rule means.

---

## 5 · Colour

All values below were generated in OKLCH and measured for WCAG contrast during design.
The generator is to be committed as `scripts/palette.mjs` as part of implementation
(§9.2); until then these literals are the source of truth.

### 5.1 Surfaces and chrome

| Token | Nocturne | Modernist |
| --- | --- | --- |
| `--bg` | `#12151a` | `#ffffff` |
| `--surface` | `#1a1e25` | `#f4f5f6` |
| `--surface-2` | `#242931` | `#e9ebed` |
| `--rule` | `#2e343d` | `#d5d9dd` |
| `--rule-strong` | `#434a55` | `#1a1d22` |
| `--text` | `#eef1f5` (12.90:1) | `#14171c` (15.03:1) |
| `--text-muted` | `#9aa3b0` (5.74:1) | `#5b6472` (5.00:1) |
| `--accent` | `#35c07d` (6.26:1) | `#0e7a4a` (4.50:1) |
| `--on-accent` | `#0a0d11` (8.33:1) | `#ffffff` (5.38:1) |

Ratios are against `--surface-2`. These tokens absorb the ten `--ui-*` aliases that
currently live in the prototype's `<style>` block.

**The accent is green in both grounds.** Hot runs yellow→red and cold runs blue, so the
identity colour cannot be either without reading as data. Green is the maximum hue
distance from both. This also fixes a live collision: Modernist's current accent
`#ec3013` sits almost on top of its own `--hot-5` `#8e1408`.

### 5.2 Data ramps — fills

Salience rises with intensity in **both** grounds. On dark that means climbing in
luminance (black-body: deep red → white-hot yellow); on light it means descending
(ink on paper). Every step is ≥0.109 apart in OKLCH lightness, so no two are
confusable.

```css
html[data-theme="nocturne"] {
  --hot-1:#8d3a32; --hot-2:#b45f37; --hot-3:#d6883e; --hot-4:#f2b64e; --hot-5:#ffe76c;
  --cold-1:#335698; --cold-2:#4f7cb4; --cold-3:#71a2cf; --cold-4:#98c9eb; --cold-5:#c4efff;
  --neutral-mid:#39404b;
}
html[data-theme="modernist"] {
  --hot-1:#ebd06b; --hot-2:#dba33f; --hot-3:#c6761e; --hot-4:#ac4a11; --hot-5:#8d1b17;
  --cold-1:#aad9f2; --cold-2:#7db2d8; --cold-3:#558bbe; --cold-4:#3563a4; --cold-5:#203a89;
  --neutral-mid:#d9dcdf;
}
```

Contrast against `--surface-2`, step 1 → 5: Nocturne hot 1.94 → 11.76, cold 2.04 →
11.93; Modernist hot 1.28 → 7.63, cold 1.26 → 8.66.

### 5.3 Data ramps — ink

**Fills and ink are different variables.** A polygon fill and a number tinted by the
same value have different contrast requirements; sharing five variables between them is
the root cause of every contrast failure in the current build.

**Ink is not a ramp.** Forcing a five-step ink ramp past 4.5:1 squeezes steps 3–5 to
within 0.02 OKLCH lightness of each other and destroys the ordering. Text needs two
levels, not five:

| Token | Nocturne | Modernist |
| --- | --- | --- |
| `--hot-ink` | `#f2b64e` (8.06:1) | `#ac4a11` (4.70:1) |
| `--cold-ink` | `#98c9eb` (8.28:1) | `#3563a4` (5.06:1) |

Every text use — KPI figures, table cells, compare values, tooltip headings — reads
`-ink`. Fills are for geometry and legend strips only.

### 5.4 Bars — track-anchored gradients

Every measure bar (Compare matrix, KPI split bar, confidence distribution, cluster
card) fills with the ramp as a **gradient anchored to the track, not to the bar**.

```css
.bar-fill {
  background-image: linear-gradient(90deg, var(--hot-1), var(--hot-5));
  background-size: calc(100% * var(--track-ratio)) 100%;  /* 1 / bar fraction */
  background-repeat: no-repeat;
  border-right: 2px solid var(--text);                    /* the end cap */
}
```

**Why anchored to the track.** If the gradient spans the bar's own width, every bar —
at 20% or at 100% — runs the complete ramp and ends in the hottest colour. Colour then
carries no information while appearing to, and a city with 6,420 people in hot spots
terminates in the same alarm-red as one with 30,653. Anchored to the track, a 20% bar
shows only the first 20% of the ramp, so colour at any horizontal position means the
same thing on every row and the bar's tip reads as a position on the scale. It also
matches the map legend exactly, which a flat fill does not.

**Why the end cap is mandatory.** No single track colour contrasts with a full-range
ramp. Measured against four candidate Nocturne tracks, the weakest ramp step lands at
1.04–1.24:1 — a bar whose tip falls near that step has an invisible end, and "very
small" becomes indistinguishable from "zero". The 2px `--text` cap makes the extent
explicit regardless of fill colour. It is not decoration; **a bar without it is not
readable and must not ship.**

| Token | Nocturne | Modernist |
| --- | --- | --- |
| `--track` | `#b6bdc9` (9.68:1 vs `--bg`) | `#c2c8cf` |
| bar end cap | 2px `var(--text)` | 2px `var(--text)` |

The light track on the dark ground is deliberate and is what makes the corrected
Nocturne ramp usable: that ramp runs deep red → bright yellow, so a bar *starts* dark
and would vanish into a dark trough.

### 5.5 Contrast audit

Live failures and their replacements:

| Use | Today | | Field | |
| --- | --- | --- | --- | --- |
| Nocturne · cold KPI figure | `#3467ad` | **2.49** | `#98c9eb` | 8.28 |
| Nocturne · segmented control active | white on `#9184d9` | **3.23** | `#0a0d11` on `#35c07d` | 8.33 |
| Nocturne · severe cold polygon vs ground | `#20407c` | **1.45** | `#c4efff` | 11.93 |
| Modernist · table, low-SUHI city | `#e9b420` | **1.45** | `#ac4a11` | 4.70 |
| Modernist · accent as body text | `#ec3013` | **3.20** | `#0e7a4a` | 4.50 |
| Modernist · segmented control active | white on `#ec3013` | **4.20** | white on `#0e7a4a` | 5.38 |
| Nocturne · hot KPI figure | `#e06b2f` | 4.25 | `#f2b64e` | 8.06 |

A CI check must re-run this audit and fail the build on any regression (§9.2).

---

## 6 · Data encoding

### 6.1 The encoding variable

A single function owns what colour means. **Nothing else reads the underlying field.**

```js
// The signed intensity a spot is coloured by.
// INTERIM: city-relative LST. Replace the body when Gi* z-scores arrive (§10.1).
function encodeValue(spot) {
  return spot.mean_lst - cityPeriodMeanL50(spot.city, spot.period);
}
```

`cityPeriodMeanL50` is the mean of `mean_lst` over that city's **L50** contours for the
**same acquisition period**. Period-matching matters: day and night are different
acquisitions and must not contaminate each other.

**Why not `suhii`:** 53.5% sign agreement with the hot/cold class. Measured alternatives:

| Variable | Sign agrees with class |
| --- | --- |
| `suhii` (current) | 236/441 — **53.5%** |
| `mean_lst` − national mean, same period | 253/439 — 57.6% |
| `mean_lst` − city mean, all levels, same period | 355/439 — 80.9% |
| **`mean_lst` − city L50 mean, same period** | **379/439 — 86.3%** |

Broken down, `suhii` fails worst exactly where it matters: night cold spots disagree
93% of the time (96/103), day cold 55%, day hot 31%, night hot 11%.

The derived field is named **`lst_rel`**, never `gi_z` or anything implying it is the
Gi\* statistic. **It is a proxy, not the statistic** — this must be stated in the method
note and in the spot drawer.

### 6.2 The diverging ramp

One continuous scale. Domain **±4.5 °C, clamped** — the 95th percentile of `|lst_rel|`
is 4.43, so roughly 5% of spots clamp at the extremes.

```
--cold-5 … --cold-1  ·  --neutral-mid  ·  --hot-1 … --hot-5
  −4.5 °C                    0 °C                   +4.5 °C
```

The neutral midpoint is deliberately the **least salient** point in both grounds
(Nocturne `#39404b` at 1.40:1; Modernist `#d9dcdf` at 1.15:1) — "no signal" should
recede.

Observed distribution (n=439): min −5.95, p05 −3.62, median 0.00, p95 +3.74, max +6.65.
Hot-classified spots median **+0.92**, cold-classified median **−1.10** — the separation
that makes the variable usable.

### 6.3 Class in the outline, never the fill

| Encoding | Carries |
| --- | --- |
| Fill | `lst_rel` on the diverging ramp — how much cooler or hotter than the rest of this city |
| Outline colour | `spot_type` — warm stroke = hot-classified, cool stroke = cold-classified |
| Outline style | `bh_significant` — solid if significant, dashed if not |
| Outline weight | Zoom-interpolated (§8.2) |

This makes the ~13.7% where class and temperature disagree **visible rather than
clamped away** — the same principle as showing BH non-significance instead of filtering
it. A cold-classified spot that genuinely runs warmer than its city renders warm with a
cool outline, and the reader sees the tension.

The legend must name the variable in plain language — "warmer or cooler than the rest of
this city" — not in jargon. When the Gi\* z-score replaces `lst_rel`, the legend string
changes with it.

---

## 7 · Information architecture

The brief is clarity for non-experts, so the organising principle is **progressive
disclosure**. The current rail is eleven ungrouped sections deep; that is the layout
most at odds with the brief.

### 7.1 The headline sentence

Above the map, as the first thing read:

> **137,470** people live inside a hot spot
> *National · 55 cities · 2024 composite*
> Across 95 hot spots covering 3,018 km² — 3.4% of the studied area. 25 of 441 contours
> are significant after correction.

The figure takes `--hot-ink`, so the sentence doubles as a colour key. It rewrites on
scope change — *"15,378 people in Ìbàdàn live inside a hot spot"* — same structure, same
slot, no layout change. One string template per language: four dictionary entries, not a
new screen.

A number grid asks the reader to assemble the finding. A sentence hands it to them.

### 7.2 Header and navigation

| Change | Reason |
| --- | --- |
| **Remove the Export button** | Its handler is `exportBtn.onclick = () => selectTab('report')`. It is a tab wearing a button, sitting beside the tab it duplicates. |
| **Move "Framed" into the rail's Display group** | A presentation toggle occupying primary navigation space most readers will never use. |
| **Tabs become one word: Map · Compare · Table · Report** | Faster to scan, and survives translation — "Compare cities" becomes "Kwatanta birane" in Hausa and the bar begins to wrap. |
| **Add a density control** beside language and theme | `data-density` is a real token (§4.2); it needs a control. |

Header height stays 54px with a `--rule-strong` underline.

### 7.3 Rail — three disclosure groups

| Group | Contains | Default |
| --- | --- | --- |
| **Scope** | Search, headline sentence, KPI block, confidence distribution | Open |
| **Display** | Basemap, contour level, layer toggles, fill opacity, Framed | Collapsed |
| **Explain** | Cluster typology, population circles, year slider, legend | Collapsed |

Researcher detail stays reachable; it stops being the first thing a non-expert meets.

### 7.4 Map stage

Retained from the original because the reasoning holds: the draggable day/night wipe
(the difference between acquisitions *is* the finding), proportional city circles on one
shared sqrt scale, and the geometry-exaggeration disclosure at low zoom.

### 7.5 Compare cities

Two layers: **a chart answering *what is the shape*, over a matrix answering *what is
the number*.**

#### 7.5.1 Two defects in the current view

1. **55 city pills fill the screen before any data appears.** Replaced by search-to-add
   with selected cities as removable chips.
2. **Bars scale against the national maximum.** Lagos is 30,653 and the median city is
   623, so the median city's bar is **2% wide** — fifty of fifty-five cities render as a
   sliver. The view's own lede concedes this: *"lengths compare down a column but not
   across them."* **Bars now scale to the maximum of the selected set**, and the lede
   says so.

#### 7.5.2 The matrix

Transposed from the current cards: **measures down, cities across.** Cards force the eye
to jump between boxes to compare one measure; a matrix puts the comparison along a row.
Capped at **four** cities — five made columns too narrow for the bars to read.

Rows: population in hot spots, SUHI intensity, % of city hot, population in cold spots,
warming trend. Typology line in the footer.

Bars use the track-anchored gradient and the mandatory end cap from §5.4. Because the
gradient is anchored to the track and the track is scaled to the selected set, a bar's
tip encodes two things at once — its length against the other chosen cities, and its
colour position on the same ramp the map uses. The clustered bar charts in §7.5.3 take
the identical treatment, so the whole Compare tab reads as one system.

#### 7.5.3 The chart layer

A segmented control selects one of three. **No chart uses a time axis.** The year slider
back-casts a linear Sen slope, so any 2015–2024 series would be a straight line by
construction — it would look like a decade of observation and be none of it. All three
axes below are measured.

**Chart A — Day → night (default). Horizontal clustered bars.**
Day and night bars per city, rows sorted by overnight change. Horizontal because the
values are signed and city names are long; negative bars extend left of zero against a
shaded "cooler than rural background" region.

This chart carries a finding the composite average hides entirely. Of the 30 cities with
both day and night L50 hot spots, **22 cool at night and 8 get hotter — and all 8 are
northern**:

| City | Day | Night | Change |
| --- | --- | --- | --- |
| Maiduguri | −1.50 | **+0.89** | +2.39 |
| Katsina | −0.61 | +0.79 | +1.40 |
| Gusau | −1.41 | −0.02 | +1.39 |
| Bauchi | −0.94 | −0.30 | +0.64 |
| Akure | +3.66 | +0.36 | −3.30 |
| Calabar | +2.90 | +0.55 | −2.35 |
| Ibadan | +3.43 | +1.26 | −2.17 |

Maiduguri's hot spots are *cooler* than the rural background in daylight and *hotter*
after dark. Night heat matters more for health than any daytime figure, because it is
what prevents physiological recovery.

*Rejected: a slope chart. It showed the reversal as crossing lines, but bars read better
for signed values and long labels, and sorting by change recovers the pattern.*

**Chart B — Contour profile L50 → L75 → L90. Clustered vertical bars.**
Two series across three ordered groups; 53 of 55 cities have all three levels. Mean SUHI
rises +0.64 → +0.77 → +0.80 °C while mean area collapses 31.8 → 17.7 → 7.1 km². **Area
falls 78% while intensity rises 25%** — the two series moving in opposite directions is
the point. Per city this becomes a small multiple: a steep area line means heat packed
into a tight core, a shallow one means it is spread across the urban area, and those
imply different interventions.

**Chart C — Concentration. Bars, cumulative annotated not drawn.**
Cities ranked by population in hot spots. **Lagos alone is 22.3% of all 137,472 people
affected; the top 5 are 58.5%, the top 10 are 75.3%, the top 20 are 93.2%.** This turns
55 rows into a budget decision and does not exist in the current build.

### 7.6 Data table

**The defect:** 17 columns, 1,592px wide in a 585px panel — a 1,007px horizontal
scroll, with no sticky header and no sticky first column. Scrolling right leaves the
reader with unlabelled numbers in unlabelled rows.

**Default columns — seven.** The concept doc says officials want *"which cities are
worst, how many people are inside a hot spot, is it getting worse."* That is three
columns; with the city and the two counts it is seven:

| # | Column | Serves |
| --- | --- | --- |
| 1 | City *(sticky)* | identity |
| 2 | Hot spots | count |
| 3 | Cold spots | count |
| 4 | **Population in hot spots** *(default sort, descending)* | "how many people" |
| 5 | SUHI °C | "which are worst" |
| 6 | % of city hot | worst, normalised for city size |
| 7 | Warming trend °C/dec | "is it getting worse" |

The remaining ten — mean/max LST, cold population, hot and cold area, MODIS hot days,
cluster, landcover, elevation, geology — sit behind a **"show all 17 fields"** toggle.
They are the researcher set: one click away, never in a non-expert's path.

**Sticky header and sticky city column.** Row click opens that city on the map.

**The lede must state that the ranking changes with the metric**, because it does: the
top ten by population and the top ten by SUHI overlap only **6 of 10**. Lagos is first
by population and ninth by intensity; Maiduguri leads on share-of-city and appears in
neither top ten.

### 7.7 Reports

**The brief takes two thirds of the page; exports compress to a single control.** Six
non-functional placeholder cards currently share equal billing with the one element on
the page that works — the brief generates real prose from real figures and is the
artifact that actually reaches a decision-maker.

**Export control:** a `<select>` listing the six formats, each option carrying its
detail as secondary text, plus a **Download button that stays inactive until a format is
chosen**. This also removes the present problem of six buttons that do nothing. The
active contour, cluster and year filters apply to the export, and the control says so.

Once the brief has the print stylesheet (§8.5), "City brief · PDF" is `window.print()`
on a page already designed for A4.

### 7.8 Mobile

At `touch` density the rail becomes a bottom sheet with the headline sentence and KPI
block visible above the fold and the Display/Explain groups behind a handle. 44px
minimum hit targets. The Compare matrix scrolls horizontally with a sticky measure
column; the chart layer keeps its horizontal bar form, which already suits a narrow
viewport. This is a density and container change, not a second layout.

---

## 8 · Technical architecture

### 8.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite + TypeScript | Static output; Cloudflare Pages needs no adapter |
| Map | **MapLibre GL JS v6** | GPU rendering, data-driven styling, no API key, no vendor |
| Basemap | **PMTiles + Protomaps** | Single static file, styled from our own tokens |
| Behaviour | Headless primitives (Radix / React Aria) | Focus traps, keyboard nav, ARIA — zero visual opinion |
| Charts | Observable Plot | d3 already a dependency; themed via CSS vars |
| Table | TanStack Table | Sorting, virtualization, headless |
| URL state | Typed search params | Deep links (§8.4) |

Explicitly **not** used: Tailwind config or a JS theme object for tokens (that is where
the look drifts), and any heavy data framework — 441 rows is trivially small.

### 8.2 Why MapLibre

The current build re-creates every Leaflet layer on each zoom, filter change and
year-slider tick, and walks coordinate arrays in JS to exaggerate geometry. Under
MapLibre, fill and stroke become data-driven expressions evaluated on the GPU:
`renderSpots()` and its `clearLayers()` cycle disappear, and zoom-dependent stroke
weight becomes an `interpolate` expression rather than a JS branch.

It also unlocks three items already in the original backlog: PMTiles, real admin
geometry, and a queryable physiographic layer.

### 8.3 The basemap joins the design system

Today an Esri basemap sits under two design systems and belongs to neither. A
self-hosted Protomaps basemap, styled with a MapLibre style JSON that reads our own
tokens, means roads, water, landuse and labels flip with `data-theme` like everything
else. It also removes the Esri dependency and makes tile failure (a known risk)
near-impossible, since we serve our own file.

### 8.4 Deep links

Encode scope in the URL: city, contour level, cluster, year, theme, language, basemap,
density, divider position. This is what makes a screenshot in a ministry memo
reproducible.

### 8.5 Print

A real `@media print` stylesheet for the city brief: one A4 page, no clipped text, in
either ground. The current build has **zero** print styles despite planning to call
`window.print()`.

### 8.6 Deployment

Cloudflare Pages, static. No `.nojekyll` trap, better tile caching, free custom domain.
No backend until there is private data, user uploads, or server-side Gi\* recomputation.
If the contour data outgrows the browser, the answer is PMTiles — not an API.

---

## 9 · Correctness work

### 9.1 Bugs to fix (verified in the running build)

| # | Bug | Impact |
| --- | --- | --- |
| 1 | ~~All 16 `clusters.json` typology strings are mojibake~~ — **RETRACTED 2026-10-13. Not a defect.** The file is valid UTF-8 (`c2 b7` for `·`, `e2 80 93` for `–`) and parses to `Grassland · 101–500 m · Metamorphic`. The original finding came from reading the file with Python's default encoding, which is cp1252 on Windows; the corruption was in the reading, not the data. | none |
| 2 | `buildRail()` hardcodes `data-on="true"`, so changing language desyncs toggle visuals from `state.layers` | Permanent wrong state |
| 3 | Layer toggles are `<div onclick>` — no keyboard, no `role="switch"`, no `aria-checked` | Six controls unreachable without a mouse |
| 4 | `openCity()` population bar divides by the magic number `230` | Wrong bar lengths |
| 5 | KPI share bar uses `Math.min(50, pctHot*6)` | Bar is not proportional to anything |
| 6 | State graticule uses `d3.geoBounds(NG)` as extent, unclipped | Dashed "state lines" run over Niger, Cameroon and the sea |
| 7 | "Typology & confidence" KPI tile has no `.val` | Breaks the tile grammar of the other five |
| 8 | Zero `@media` queries, no `prefers-reduced-motion`, no `aria-live` | Fails criteria 1 and 5 |
| 9 | `data/` duplicated in `project/` and `design_handoff_suhi_dashboard/` | Guaranteed drift |
| 10 | Docs say city circles are z-index 460; code sets `cityPane` to 410 | Circles render below spots, contrary to spec |

### 9.2 Build-time guards

- `scripts/derive.mjs` regenerates `cities.json` and `clusters.json` from the source
  GeoJSON, implementing the L50-only aggregation rules. Its output was verified
  **field-by-field against the pre-branch published values: 1,647 fields, exactly one
  intended change (cluster 16's typology abbreviation)**. The byte-for-byte guard now binds
  derive's own output going forward.
- `scripts/palette.mjs` regenerates the ramps (it cannot fail anything).
  `scripts/audit-contrast.mjs` **fails the build** on any text pair below 4.5:1, checking
  every text token on all three grounds (`--bg`, `--surface`, `--surface-2`). Success criterion 1 becomes a test, not an intention.
- A diacritic fixture renders every dictionary string in all four languages at every
  scale step and fails on a missing glyph.

---

## 10 · Open items

### 10.1 Blocked — Gi\* z-score

The analysis that produced `master_hotspot_gdf` has the Gi\* statistic; the exported
50-attribute GeoJSON does not. Only `mk_p_value` is present, which is the Mann-Kendall
*trend* test, not the hotspot statistic.

When it arrives: change the body of `encodeValue()` and the legend string. Nothing else
— not the ramp, the domain shape, the map style, the KPIs or the components. The domain
bounds (§6.2) will need recomputing for the new units.

*Owner: the user's supervisor. Not blocking any work in this spec.*

### 10.2 Blocked — carried over from the original backlog

- **City-total population.** Only in-contour population exists. Joining WorldPop 2024 or
  GRID3 would let the circles show city / hot / cold as three nested rings.
- **State and national boundaries.** Currently a graticule placeholder and a 1:110m
  Natural Earth outline. Replace both with GRID3 Nigeria or GADM level 1.
- **Native review of Hausa, Igbo and Yorùbá.** The dictionary is a first pass. Tone
  marks carry meaning; a wrong mark changes the word. Each language needs a named
  reviewer recorded in the repo before the standing "first pass" note is removed.

### 10.3 Non-goals

No login, no saved views, no editing, no geocoder beyond the 55 study cities, no time
series (there is no time series in the data), and no backend service.

---

## 11 · Decision log

| Decision | Chosen | Rejected |
| --- | --- | --- |
| Design intent | Clarity for non-experts | Institutional authority; striking/contemporary; distinctly Nigerian |
| Brand | None — invent the identity | University / ministry / donor co-branding |
| Theme structure | One system, two grounds | Keep both as-is; two independent systems redesigned |
| Primary surface | Laptop/desktop first | Phone-first (recommended); projector-first; print-first |
| Visual direction | **Field** | Instrument; Briefing |
| Radius | **Sharp — 0 / 2 / 4px** | Soft-sharp — 2 / 4 / 8px |
| Headline sentence | Adopted from Briefing | — |
| Map encoding | **One diverging ramp, class in outline** | Two ramps keyed by class |
| Encoding variable | `lst_rel` (interim), `gi_z` when available | `suhii` (53.5% agreement) |
| Header | Export removed, Framed demoted, one-word tabs, density control added | Keep as-is |
| Table | 7 default columns, sticky city + header, 17 behind a toggle | All 17 columns always |
| Compare form | Transposed matrix, 4 cities, scaled to selected set | Per-city cards, 5 cities, national-max scaling |
| Compare chart | **A1 — horizontal clustered bars, day vs night** | Slope chart; diverging single bar (A2) |
| Chart axes | Day/night, contour level, city rank | Any time axis — would be a straight line by construction |
| Reports | Brief two-thirds; exports as one select + Download | Six equal export cards |
| Bar fill | **Gradient anchored to the track, 2px end cap, light track** | Gradient per bar (colour would mean nothing); flat ink |

---

## 12 · Next step

An implementation plan, ordered with acceptance criteria per task, covering: the token
layer, the correctness fixes, the MapLibre/PMTiles rebuild, the IA restructure, and
deployment. To be produced via the `writing-plans` skill once this spec is approved.
