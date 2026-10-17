# Nigeria SUHI dashboard — design system and prototype rebuild

**Date:** 2026-10-14
**Status:** Revision 2 — supersedes the design in revision 1
**Revises:** `2026-10-13-suhi-dashboard-design-system-design.md` (committed `5bc4d1d`)
**Fidelity target:** `project/nigeria-suhi-dashboard.html`

Revision 1 specified a new visual direction. This revision replaces it with a
pixel-for-pixel rebuild of the original prototype, keeping only the corrections that
measurement requires. Sections 1, 6 and 10 carry over from revision 1
largely unchanged; sections 2, 3, 4, 5, 7, 8.1, 9.2, 11 and 12 are rewritten.
§11 records every reversal.

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

### Why rebuild rather than redesign

The original design is the approved design. It is coherent, it was authored for this
study, and it is what the stakeholder signed off on. Nothing in the measurement work
below is an argument against its look.

What the measurement work did find is three defects that survive any look:

1. **The colour encoding is uninformative.** `suhii`'s sign agrees with a spot's
   hot/cold class only **53.5%** of the time (236/441) — a coin flip. The variable
   driving every polygon's colour is statistically unrelated to what the polygon is.
   `lst_rel` (a spot's `mean_lst` minus its city/period L50 mean) agrees **86.3%**
   (379/439). This is a data bug, not a style choice.
2. **Nine tokens produce text/ground pairs that fail WCAG AA**, across both themes,
   measured against the grounds the prototype actually puts that text on (§5.2).
   Contrast is a measurable requirement with a published threshold; the palette can
   meet it without changing hue or chroma.
3. **The ramp tokens are used as both map fills and body text.** One token cannot
   satisfy a fill's salience requirement and a 12px label's contrast requirement at
   once. Splitting fill from ink fixes the text without touching a single pixel of
   the map (§5.4).

So this document specifies a **pixel-for-pixel rebuild** of
`project/nigeria-suhi-dashboard.html` on a maintainable stack, with those three
defects corrected and nothing else changed.


---

## 2 · Brief

**Priority:** clarity for non-experts. An official or field officer gets the finding
fast; researcher detail lives one layer down.

**Constraints**

- No external brand to honour. The identity is the study's own.
- Nocturne (dark) and Modernist (light) stay **two independent design systems**, exactly
  as the original defines them (§3.1). Switching theme changes type, spacing, radius and
  rule weight as well as brightness — because that is what the original does.
- Design around laptop/desktop first.
- Four languages: English, Hausa, Igbo, Yorùbá.
- Deploys to Cloudflare Pages as a static site.

**Success criteria**

1. Every text-on-ground pair clears 4.5:1 (3:1 for large text) in **both themes**,
   measured not eyeballed (§9.2).
2. The rebuild and `project/nigeria-suhi-dashboard.html` are indistinguishable side by
   side, except for the four changes in §3 — enforced, not asserted (§9.2).
3. The map encodes a variable that agrees with a spot's class (§6.1).
4. All four languages render with diacritics intact at every size, in both families.

Criterion 2 replaces revision 1's "one component set serves both grounds", which this
revision rejects. Revision 1's "usable at 390px" is **dropped as a criterion** and
recorded as an open item instead (§10.3) — the original is not usable at 390px, and the
fidelity rule reproduces that. Revision 1's "a non-expert can state the national finding
within ten seconds" went with the headline sentence, which is not adopted (§11).

**Scope.** Same four views, same 441 spots / 55 cities, same four languages. This is a
re-implementation of the original on a maintainable stack, plus the map engine and the
corrections in §3 — not a redesign, and not new analysis.

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

## 3 · Fidelity rule

The target is `project/nigeria-suhi-dashboard.html` (1,179 lines). It is the
specification for everything visual. The rebuild is correct when the two look the
same side by side.

**Unchanged — copied from the original, exactly:**

| What | Rule |
| --- | --- |
| Layout | Every width, height, gap, padding and grid as the original computes them |
| Type | Both families, both weights, every `font-size` including the 9.5px and 10px labels |
| Spacing | Both scales as declared — Nocturne 2.8/5.6/8.4/11.2/16.8/22.4px, Modernist 4/8/12/16/24/32px |
| Radius | Nocturne 4/8/14px, Modernist 0/0/0 |
| Rules | `--ui-rule` 1px Nocturne, 2px Modernist |
| Surfaces | Every `--color-*` and `--ui-*` value byte-identical |
| Ramp fills | All ten `--hot-*` / `--cold-*` values byte-identical |
| Components | Same elements, same order, same states, same copy |

**Changed — only where measurement requires it:**

| What | Rule | Section |
| --- | --- | --- |
| Encoding variable | `suhii` to `lst_rel` | §6.1 |
| Ramp direction | One diverging ramp, class in the outline | §6.2, §6.3 |
| Text colour | A parallel `*-ink` scale for every text usage | §5.2–§5.5 |
| Accent fills | New `--accent-fill` for white-on-accent surfaces | §5.6 |

Nothing else. A change that is not in the second table and not in §9 is out of scope,
however much it would improve the design.

### 3.1 Two systems, not one

Nocturne and Modernist stay **two independent design systems**, as the original defines
them: different families (Inter 500 / Archivo 800), different spacing scales (0.7x /
1.0x), different radii (4/8/14 / 0/0/0), different rule weights (1px / 2px). They are
not one system with two grounds.

This is the explicit choice. It costs rigour — every rule has to hold twice, and the
contrast audit has to run per theme per ground — and the build guards in §9.2 are what
pays that cost.

### 3.2 The trade this rule makes

Two consequences, stated plainly rather than discovered later:

- **The original's 9.5px and 10px labels are kept.** WCAG sets no minimum font size, so
  these are not accessibility failures; they are a legibility judgement, and that
  judgement belongs to whoever approved the design. Contrast is the measurable rule,
  and §5 holds it at every one of those sizes.
- **Nocturne's ramps keep their original direction as fills.** Mild hot sits at 13.4:1
  against the map ground and severe hot at 3.4:1 — brighter means milder, which is
  backwards for salience. §6.2 changes what the ramp *encodes* (one diverging ramp over
  `lst_rel`, not two ramps over `suhii`), which puts the extremes at both ends where
  they read correctly, without re-authoring a single swatch.

---

## 4 · Foundations — copied, not designed

Both token blocks are lifted verbatim from the original and are the authority. They move
from the page's `<style>` into `src/styles/suhi-tokens.css` unchanged.

### 4.1 Nocturne

```css
html[data-theme="nocturne"]{
  --color-bg:#161826; --color-surface:#232532; --color-text:#e9e9ed; --color-accent:#9184d9;
  --font-heading:"Inter",system-ui,sans-serif; --font-heading-weight:500;
  --space-1:2.8px; --space-2:5.6px; --space-3:8.4px;
  --space-4:11.2px; --space-6:16.8px; --space-8:22.4px;
  --radius-sm:4px; --radius-md:8px; --radius-lg:14px;
  --ui-panel:#1c1e2b; --ui-panel-2:#292b31; --ui-line:#3f424d; --ui-line-strong:#595d6c;
  --ui-muted:#9397ab; --ui-rule:1px; --ui-tip:#1b1e2b; --ui-scrim:rgba(16,17,25,.78);
  --hot-1:#f6e08a; --hot-2:#f2c14e; --hot-3:#ec9a3c; --hot-4:#e06b2f; --hot-5:#c9382c;
  --cold-1:#cfe4f7; --cold-2:#8fbfe8; --cold-3:#5793d1; --cold-4:#3467ad; --cold-5:#20407c;
  --spot-stroke:#e9e9ed;
}
```

### 4.2 Modernist

```css
html[data-theme="modernist"]{
  --color-bg:#f3f2f2; --color-surface:#eae9e9; --color-text:#201e1d; --color-accent:#ec3013;
  --font-heading:"Archivo",system-ui,sans-serif; --font-heading-weight:800;
  --space-1:4px; --space-2:8px; --space-3:12px;
  --space-4:16px; --space-6:24px; --space-8:32px;
  --radius-sm:0px; --radius-md:0px; --radius-lg:0px;
  --ui-panel:#eae9e9; --ui-panel-2:#e2e0e0; --ui-line:#201e1d; --ui-line-strong:#201e1d;
  --ui-muted:#605d5d; --ui-rule:2px; --ui-tip:#ffffff; --ui-scrim:rgba(243,242,242,.9);
  --hot-1:#e9b420; --hot-2:#e0902a; --hot-3:#d6691f; --hot-4:#c03c1a; --hot-5:#8e1408;
  --cold-1:#a8cfe8; --cold-2:#6ba6d8; --cold-3:#3d79bd; --cold-4:#23539b; --cold-5:#12306b;
  --spot-stroke:#201e1d;
}
```

### 4.3 What the retarget deletes

`scripts/lib/tokens.mjs` currently holds `THEME_TOKENS` and `SCALE_TOKENS` for the
abandoned "Field" direction, and `scripts/palette.mjs` generates `_ramps.css` from
`buildRamp()`. Under this spec the ramps are **authored values, not generated ones**:

- `THEME_TOKENS` is replaced by the two blocks above, as data, for the audit to read.
- `SCALE_TOKENS` is deleted. Two independent scales are declared per theme in CSS;
  there is no shared scale to generate.
- `scripts/palette.mjs` and `src/styles/_ramps.css` are deleted. `buildRamp()` and
  `RAMPS` in `scripts/lib/ramps.mjs` are deleted with them. The OKLCH primitives in
  `scripts/lib/color.mjs` stay — the audit and the ink derivation both need them.

Two tests in `ramps.test.mjs` were parked against this retarget (ruling 24) and are
resolved by the deletion, not by being fixed: the "classifies at least one dark and one
light ground" guard and `signFor`'s absolute-luminance threshold both exist to serve a
generated single-system palette. The audit (§9.2) replaces them.

---

## 5 · Colour — the measured corrections

Every number below was measured with `scripts/lib/color.mjs` against the grounds the
prototype actually renders that text on, at the size and weight it renders it.

### 5.1 Method

For each text usage: the smallest move in OKLCH **lightness** — hue and chroma held
exactly — that clears the floor on *every* ground that usage appears on. Minimising the
lightness delta is what keeps the correction faithful: the colour stays the same colour,
slightly lighter or darker.

Floors are WCAG 2.1 AA: **4.5:1** for body text, **3.0:1** for large text, where large
means >=24px at any weight or >=18.66px when bold.

**The floor differs per theme for the same element**, because the two systems set
different heading weights. `--font-heading-weight` is **500** in Nocturne and **800** in
Modernist, and `.kpi .val` is not uniformly 24px - three of the six tiles override it
inline (the share tile at 19px, the two population tiles at 20px). So:

| Rendered figure | Nocturne (500) | Modernist (800) |
| --- | --- | --- |
| 24px count tiles | large, 3.0 | large, 3.0 |
| 20px population tiles | **body, 4.5** | large, 3.0 |
| 19px share tile, 19px Compare footer | **body, 4.5** | large, 3.0 |
| 13px and below | body, 4.5 | body, 4.5 |

This is the clearest consequence of keeping two independent systems: an identical element
is held to two different standards. Rather than track that per usage, **the ink scale
clears 4.5:1 on every ground in both themes** - the strictest floor any usage above can
take. The derivation is therefore correct whatever the weight, and §5.5's cost is the
price of that robustness.

Grounds that carry ramp-coloured text: `--color-bg`, `--ui-panel-2`, `--ui-tip`.

### 5.2 Where ramp colour reaches text

Verified against the prototype's render functions, not inferred from the stylesheet. The
complete inventory of coloured **text** (fills are in §5.7):

| Where | Size / weight | Ground | Colour source |
| --- | --- | --- | --- |
| `.kpi.hot .val` / `.kpi.cold .val` counts | 24px / heading | `--ui-panel-2` | `--hot-4`, `--cold-4` |
| `.kpi .val` share tile | 19px / heading | `--ui-panel-2` | `--hot-4`, `--cold-4` |
| `.kpi .val` population tiles | 20px / heading | `--ui-panel-2` | `--hot-4`, `--cold-4` |
| Compare card SUHI figure | 13px | `--ui-panel-2` | `hotScale(suhii)` — the whole ramp |
| Compare cluster note | 11px | `--ui-panel-2` | `--color-accent` |
| Compare footer trio | 19px / heading | `--ui-panel-2` | `--hot-4`, `--cold-4` |
| `table.dt td` hot / cold / slope / cluster | 12px | `--color-bg` | `--hot-4`, `--cold-4`, `--hot-3`, `--cold-3`, `--color-accent` |
| `table.dt td` suhii | 12px | `--color-bg` | `hotScale(suhii)` — the whole ramp |
| Drawer `.dl2 dd`, `% hot` | 12px | `--color-bg` | `--hot-4`, `--cold-4`, `--hot-5` |
| `.tip dd` | 11.5px | `--ui-tip` | `--hot-4`, `--cold-4` |
| `.seg button[aria-pressed]` | 11.5px | `--color-accent` | `#ffffff` |

The failures, with the floor each pair actually takes (§5.1):

| Theme | Pair | Ratio | Floor | |
| --- | --- | --- | --- | --- |
| Nocturne | `--cold-4` on `--ui-panel-2` (24px) | 2.49 | 3.0 | fail |
| Nocturne | `--cold-4` on `--ui-panel-2` (19/20px) | 2.49 | 4.5 | fail |
| Nocturne | `--hot-4` on `--ui-panel-2` (19/20px) | 4.25 | 4.5 | fail |
| Nocturne | `--cold-4` on `--color-bg` (12px) | 3.09 | 4.5 | fail |
| Nocturne | `--cold-4` on `--ui-tip` (11.5px) | 2.91 | 4.5 | fail |
| Nocturne | `--hot-5` on `--color-bg` (12px) | 3.43 | 4.5 | fail |
| Nocturne | `--cold-3` on `--ui-panel-2` | 4.38 | 4.5 | fail |
| Nocturne | `--color-accent` on `--ui-panel-2` (11px) | 4.38 | 4.5 | fail |
| Nocturne | `#ffffff` on `--color-accent` | 3.23 | 4.5 | fail |
| Modernist | `--hot-3` on `--ui-panel-2` | 2.71 | 3.0 | fail |
| Modernist | `--hot-3` on `--color-bg` (12px) | 3.19 | 4.5 | fail |
| Modernist | `--cold-3` on `--color-bg` (12px) | 4.03 | 4.5 | fail |
| Modernist | `--cold-3` on `--ui-panel-2` (11.5px) | 3.42 | 4.5 | fail |
| Modernist | `--hot-4` on `--ui-panel-2` (19/20px) | 4.09 | 3.0 | pass |
| Modernist | `--color-accent` on `--color-bg` (11.5px) | 3.76 | 4.5 | fail |
| Modernist | `--color-accent` on `--ui-panel-2` (11px) | 3.20 | 4.5 | fail |
| Modernist | `#ffffff` on `--color-accent` | 4.20 | 4.5 | fail |

The Modernist `--hot-4` row is kept deliberately: at 4.09 it **passes** its 3.0 large-text
floor only because Modernist sets the heading weight to 800. The identical figure in
Nocturne, at weight 500, is body text and fails the same ratio against 4.5. One element,
two verdicts — and the reason §5.4 derives a scale rather than patching pairs.

### 5.3 The ramp is also a text scale

`hotScale` and `coldScale` (prototype lines 569–570) interpolate across **all five**
steps of a ramp and are used as a *text* colour in two places: the `suhii` column of
`table.dt` (12px) and the SUHI figure in the Compare card (13px).

So every step of both ramps reaches text, including the four steps that never appear as
a discrete text token. On a light ground Modernist `--hot-1` is 1.71:1 and `--cold-1` is
1.47:1 — the worst failures in the whole audit, and invisible until the interpolation is
traced.

This settles the structure: **fill and ink are two parallel scales, not a few patched
tokens.**

### 5.4 Fill and ink are separate tokens

The ten ramp tokens are **fill colours**. They keep their original values and are used
for map polygons, legend swatches and bar gradients only.

Each gets an `-ink` sibling: the same hue and chroma, lifted (Nocturne) or dropped
(Modernist) by the minimum lightness delta that clears 4.5:1 on all three text grounds.
Every text usage — discrete token or interpolated scale — switches to the ink scale.
The map is untouched.

```css
html[data-theme="nocturne"]{
  --hot-1-ink:#f6e08a;   /* unchanged */
  --hot-2-ink:#f2c14e;   /* unchanged */
  --hot-3-ink:#ec9a3c;   /* unchanged */
  --hot-4-ink:#e67035;   /* dL 0.016 */
  --hot-5-ink:#f56251;   /* dL 0.122 */
  --cold-1-ink:#cfe4f7;  /* unchanged */
  --cold-2-ink:#8fbfe8;  /* unchanged */
  --cold-3-ink:#5a96d4;  /* dL 0.010 */
  --cold-4-ink:#5e93dc;  /* dL 0.144 */
  --cold-5-ink:#6d92d5;  /* dL 0.278 */
  --accent-ink:#9386dc;  /* dL 0.008 */
}
html[data-theme="modernist"]{
  --hot-1-ink:#8b5900;   /* dL 0.294 */
  --hot-2-ink:#9b5000;   /* dL 0.210 */
  --hot-3-ink:#ac4200;   /* dL 0.124 */
  --hot-4-ink:#b83410;   /* dL 0.022 */
  --hot-5-ink:#8e1408;   /* unchanged */
  --cold-1-ink:#45687f;  /* dL 0.334 */
  --cold-2-ink:#2d6896;  /* dL 0.204 */
  --cold-3-ink:#2965a8;  /* dL 0.066 */
  --cold-4-ink:#23539b;  /* unchanged */
  --cold-5-ink:#12306b;  /* unchanged */
  --accent-ink:#cb0000;  /* dL 0.090 */
}
```

Resulting ratios — every ink token on every text ground, both themes:

| Token | Nocturne bg / panel-2 / tip | Modernist bg / panel-2 / tip |
| --- | --- | --- |
| `--hot-1-ink` | 13.37 / 10.75 / 12.59 | 5.33 / 4.53 / 5.95 |
| `--hot-2-ink` | 10.49 / 8.43 / 9.87 | 5.31 / 4.51 / 5.93 |
| `--hot-3-ink` | 7.76 / 6.24 / 7.30 | 5.32 / 4.52 / 5.94 |
| `--hot-4-ink` | 5.65 / 4.54 / 5.31 | 5.31 / 4.52 / 5.94 |
| `--hot-5-ink` | 5.66 / 4.55 / 5.33 | 8.34 / 7.09 / 9.32 |
| `--cold-1-ink` | 13.49 / 10.84 / 12.70 | 5.31 / 4.51 / 5.93 |
| `--cold-2-ink` | 9.04 / 7.27 / 8.51 | 5.32 / 4.52 / 5.95 |
| `--cold-3-ink` | 5.66 / 4.55 / 5.33 | 5.34 / 4.54 / 5.96 |
| `--cold-4-ink` | 5.60 / 4.50 / 5.27 | 6.76 / 5.74 / 7.55 |
| `--cold-5-ink` | 5.64 / 4.53 / 5.31 | 11.32 / 9.62 / 12.64 |
| `--accent-ink` | 5.60 / 4.50 / 5.27 | 5.31 / 4.51 / 5.93 |

Eleven ink token names per theme - ten ramp steps plus `--accent-ink` - and so
22 values in all, every one passing on all three grounds, in both themes.

### 5.5 What the ink scale costs

Each theme's ink ramp **compresses to near-isoluminant at the end that was failing**.
Nocturne's cold-3/4/5 land at 5.66 / 5.60 / 5.64 on the map ground; Modernist's
hot-1 through hot-4 land at 5.33 / 5.31 / 5.32 / 5.31. Those steps now differ by hue
and chroma, barely by lightness.

That is not a bug in the derivation — it is what a legibility floor does to a ramp whose
extreme end runs toward its own ground. A 4.5:1 floor is a ceiling on how dark Modernist
text may be and a floor on how dark Nocturne text may be, and a five-step ramp cannot
span a range the floor has truncated.

The consequence is that **in text, colour stops encoding magnitude** at the compressed
end. This is acceptable here and nowhere else: in all three places the ink scale is
used — the `suhii` column, the Compare figure, the KPI figure — the number itself is
printed in the same element. Colour is redundant encoding there; the digits carry the
magnitude. The ramp still encodes magnitude where it is the *only* channel, which is the
map, and the map uses the fill scale, unchanged.

Where a future surface needs colour to carry magnitude on its own without an adjacent
number, it must use the fill scale on a fill, not the ink scale on text.

### 5.6 White on accent

`.seg button[aria-pressed=true]` is white on `--color-accent` at 11.5px: 3.23:1 in
Nocturne, 4.20:1 in Modernist. White cannot be lightened, so the **fill** moves:

```css
html[data-theme="nocturne"] { --accent-fill:#796bbe; }  /* white 4.51, dL 0.082 */
html[data-theme="modernist"]{ --accent-fill:#e52706; }  /* white 4.54, dL 0.018 */
```

`--accent-fill` is used **only** where white text sits on the accent. Everywhere else —
focus borders, the swipe handle, the toggle track, and `--accent-ink` for
accent-coloured text — keeps `--color-accent` at its original value. Nocturne's active
segment therefore reads slightly deeper than the original; it is the only chrome surface
that shifts.

### 5.7 Ramp fills against the map ground

Reported for the record, not corrected. These are fills, not text; the governing
threshold is 3:1 for meaningful non-text graphics, and the original's `--spot-stroke`
outline is what carries a polygon's edge where the fill is weak.

| Step | Nocturne on `#161826` | Modernist on `#f3f2f2` |
| --- | --- | --- |
| `--hot-1` | 13.37 | 1.71 |
| `--hot-2` | 10.49 | 2.29 |
| `--hot-3` | 7.76 | 3.19 |
| `--hot-4` | 5.29 | 4.82 |
| `--hot-5` | 3.43 | 8.34 |
| `--cold-1` | 13.49 | 1.47 |
| `--cold-2` | 9.04 | 2.33 |
| `--cold-3` | 5.45 | 4.03 |
| `--cold-4` | 3.09 | 6.76 |
| `--cold-5` | 1.75 | 11.32 |

Each theme's ramp runs the wrong way for its own ground at one end — Nocturne's dark
end and Modernist's light end both fall under 3:1. §6.2 is what makes this acceptable:
once one diverging ramp spans cold-extreme to hot-extreme over `lst_rel`, the weak steps
land in the middle of the scale, where a near-zero anomaly *should* recede.

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

The neutral midpoint is deliberately the **least salient** point in both grounds — "no
signal" should recede. No new colour is invented for it; each theme's existing neutral
scale already supplies one, measured against that theme's map ground (`--ui-panel`):

| Theme | `--neutral-mid` | Value | vs map ground |
| --- | --- | --- | --- |
| Nocturne | `--color-neutral-800` | `#3f424d` | 1.65:1 |
| Modernist | `--color-neutral-400` | `#bab6b6` | 1.66:1 |

Both recede at effectively the same strength, which keeps the two themes' maps reading
alike at the midpoint even though nothing else about them is shared.

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

## 7 · Information architecture — as built

This section documents the original's structure as the fidelity target. It is a
transcription, not a proposal: where it and `project/nigeria-suhi-dashboard.html`
disagree, the file wins and this section is wrong.

### 7.1 Shell

```
.app  (column)
├── header.top
├── .body  (row)
│   ├── aside.rail        332px, fixed, scrolls
│   ├── main.stage        flex:1
│   │   └── .mapwrap  →  #map, .loading, .swipetag ×2, .swipe, .ovl ×2, aside.drawer
│   ├── section.panel#panel-compare
│   ├── section.panel#panel-table
│   └── section.panel#panel-report
└── .tip                  position:fixed, shared tooltip
```

Tabs switch which of `.stage` / the three `.panel`s has `data-on=true`. The rail and the
stage stay **mounted** across all four tabs - so their state survives a tab change - but
the original **hides both** on compare, table and report: `selectTab` (prototype line
1020) sets `rail.style.display` and `stage.style.display` to `none` unless the Map tab is
active. Mounted, not visible.

Theme and language persist to `localStorage` under `suhi.theme` (default `nocturne`) and
`suhi.lang` (default `en`), and a theme change also moves the basemap -
`nocturne` to `dark`, `modernist` to `topo` - but only until the user picks a basemap
explicitly, after which the choice is latched and the theme no longer overrides it.

`.stage.framed` adds `--space-6` padding and a `--ui-rule` border on `.mapwrap` — the
"Framed" header toggle. Kept.

### 7.2 Header

Left to right: brand (`SUHI Nigeria` + "2024 composite"), four tabs
(Map / Compare cities / Data table / Reports), spacer, language select (English, Hausa,
Igbo, Yorùbá), theme select (Nocturne · dark, Modernist · light), `Framed` toggle,
`Export` button. All kept, in that order, with that copy.

### 7.3 Rail — ten groups, flat

In order, each a `.sec-h` heading plus its control:

| # | Group | Contents |
| --- | --- | --- |
| 1 | (no heading) | `.search` + `#results` row list |
| 2 | `National · 55 cities` + `reset` | `.kpis` 2-column grid |
| 3 | `Confidence` / `Gi* / BH` | `#conf` |
| 4 | `Basemap` | `.seg` + note |
| 5 | `Contour level` | `.seg` — All 441 / L50 / L75 / L90 + note |
| 6 | `Layers` + opacity % | layer toggles + opacity range |
| 7 | `Cluster typology` + count | select + `#clusterCard` |
| 8 | `Population circles` | metric `.seg` (population / area) + scope `.seg` (both / hot / cold) + legend |
| 9 | `Year` + year value | 2015–2024 range + back-cast note |
| 10 | `Legend` | hot ramp, cold ramp, significance note |

Plus `.i18nnote` at the foot. The rail is a flat scroll — **no disclosure groups**.
The abandoned redesign collapsed these into three accordions; that is reverted.

### 7.4 Map stage

Overlay top-left: `.mapttl` (16px heading, on `--ui-scrim`), `#mapSub`, `#zoomHint`.
Overlay top-right: `+`, `−`, `Fit`. Day/night swipe comparison with two `.swipetag`s
and a draggable 2px `.swipe` at 55%. Spot click opens `.drawer` (378px, right, slides
in). Hover opens `.tip`. All kept.

The engine underneath changes — Leaflet to MapLibre (§8.2) — and the controls above are
rebuilt to drive it. The visible result is the same controls in the same places.

### 7.5 Compare cities

The original: a `.picker` of city buttons (up to five), then `.cmp`, an
`auto-fit minmax(240px, 1fr)` grid of `.card2`s — one card per city, each holding
`.cbar` rows (92px label / track / 62px value) scaled against the **national maximum**
per measure.

**One change, requested directly:** the per-city `.cbar` rows are replaced by
**horizontal clustered bars, day against night**, inside the same `.card2` in the same
grid. The card, its surface, padding, radius and the 11.5px row type are unchanged; what
changes is that each measure shows two bars instead of one.

This is the user's own adjustment to the original, not part of the abandoned redesign.
The redesign's other Compare changes — transposing to a matrix, cutting to four cities,
rescaling to the selected set — are reverted. National-max scaling stays, and so does
the lede that explains it ("lengths compare down a column but not across them").

Bar fills keep the original's track-anchored gradients
(`linear-gradient(90deg, var(--hot-2), var(--hot-5))` and the cold equivalent) on the
original `.cbar .track` background. Values beside them use the ink tokens (§5.4).

### 7.6 Data table

`table.dt` — all 17 columns, `h2` "All cities", the lede, click-to-sort headings,
click-row-to-open-on-map. Kept as-is.

The redesign's 7-default-columns-plus-toggle is reverted. The measured problem is real —
17 columns at roughly 1,592px — but on this tab the panel is the full window width, not
the 585px it was measured in, and it scrolls horizontally. That is what the original
does.

Four columns are colour-coded and all four move to the ink scale (§5.4): `hot`
(`--hot-4-ink`), `cold` (`--cold-4-ink`), `suhii` (the interpolated hot ink scale) and
`slope` (`--hot-3-ink` / `--cold-3-ink`). `cluster` moves to `--accent-ink`.

### 7.7 Reports

`h2` "Reports & export", lede, then a row: `.brief` (640px, `--ui-panel-2`, 34/38px
padding) beside a `Data export` column holding `.expgrid`
(`auto-fit minmax(210px, 1fr)`) and the filters note.

**One change, requested directly:** the export cards become a **select, with the
Download button appearing after a format is chosen**. The `.expgrid` container and its
column position are unchanged; its contents become one `select` plus one button.

As with §7.5 this is the user's adjustment, kept. Nothing else on this tab moves.

### 7.8 Mobile — the original has none

`project/nigeria-suhi-dashboard.html` contains **no `@media` query**. The 332px rail,
the 378px drawer and the 17-column table are fixed at every viewport; on a phone the
layout overflows horizontally.

Under the fidelity rule this is reproduced, not fixed: a responsive layout is a design
decision, and designing one is exactly what this revision stopped doing.

It is recorded in §10.3 as the largest open item, because four of the five audiences in
§1 read this on a phone or a projector. It needs its own approval and its own spec
section before any breakpoint is written.

---

## 8 · Technical architecture

### 8.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | **Vite + React 18 + TypeScript** | Static output; Cloudflare Pages needs no adapter |
| Styling | **Our own CSS, custom properties only** | The token blocks in §4 are the source of truth |
| Primitives | **Radix UI** — Dialog, Tabs, Switch, Slider, Select, Collapsible | Focus traps, keyboard nav, ARIA; zero visual opinion |
| Map | **MapLibre GL JS v6** | GPU rendering, data-driven styling, no API key, no vendor |
| Basemap | **PMTiles + Protomaps** | Single static file, styled from our own tokens |
| Charts | Observable Plot | d3 is already a dependency; themed via CSS vars |
| Table | TanStack Table | Sorting, virtualization, headless |
| URL state | Typed search params | Deep links (§8.4) |
| Tests | Vitest + Testing Library; Playwright | Unit, component, and the fidelity check in §9.2 |

Explicitly **not** used:

- **Tailwind.** Utility classes would re-express the original's values in a second
  vocabulary, and the two scales in §4 are not a Tailwind config — they are the design.
- **shadcn/ui.** It ships styling opinions that would have to be overridden back to the
  original on every component. Radix unstyled is the part that is actually wanted.
- **A JS theme object.** Tokens live in CSS so `data-theme` switching stays a single
  attribute flip, as in the original.
- **Any heavy data framework.** 441 features and 55 rows.

Radix is chosen over React Aria on one point: the original's controls map almost
one-to-one onto Radix parts (`.seg` to `Tabs`/`ToggleGroup`, `.ly .sw` to `Switch`,
`#opacity`/`#year` to `Slider`, `.mini-sel`/`#cluster` to `Select`, `.drawer` to a
non-modal `Dialog`), so the markup each part renders is close to the markup the CSS in
§4 already targets.

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
| 8 | No `prefers-reduced-motion`, no `aria-live` | **Fixed here** — neither costs a visible pixel. The matching "zero `@media` queries" finding is *not* fixed here: a responsive layout is a design decision, deferred to §7.8 and §10.3 |
| 9 | `data/` duplicated in `project/` and `design_handoff_suhi_dashboard/` | Guaranteed drift |
| 10 | Docs say city circles are z-index 460; code sets `cityPane` to 410 | Circles render below spots, contrary to spec |

### 9.2 Build-time guards

- `scripts/derive.mjs` regenerates `cities.json` and `clusters.json` from the source
  GeoJSON, implementing the L50-only aggregation rules. Its output was verified
  **field-by-field against the pre-branch published values: 1,647 fields, exactly one
  intended change (cluster 16's typology abbreviation)**. The byte-for-byte guard now binds
  derive's own output going forward.
- `scripts/audit-contrast.mjs` **fails the build** on any text pair below its floor. It
  is retargeted from the generated Field palette to the two authored blocks in §4:
  every text token, on the three grounds that actually carry text
  (`--color-bg`, `--ui-panel-2`, `--ui-tip`), in **both themes** — and the ink scale's
  ten steps plus `--accent-ink` are text tokens. `--accent-fill` is audited in the other
  direction: white *on* it. The large-text floor of 3.0 applies only to `.kpi .val`;
  everything else takes 4.5. Row ids stay `theme/--token@--ground`.
  This replaces the two tests parked under ruling 24 (§4.3).
- The ink scale is **derived, not hand-copied**. A test regenerates all 22 ink
  values from the fill values in §4 via `scripts/lib/color.mjs` and asserts they equal
  the CSS. A hand-edited ink token therefore fails the build, and the audit cannot be
  satisfied by weakening the derivation.
- **A fidelity guard**, which is new and is what makes §3 enforceable: a Playwright run
  loads `project/nigeria-suhi-dashboard.html` and the rebuild side by side at a fixed
  viewport, per theme, and compares the computed value of every token plus the computed
  box of every named element in §7.1. It fails on any difference outside the §3 "Changed"
  table. Without this, "pixel-for-pixel" is an intention rather than a requirement.
- `scripts/derive.mjs` keeps its byte-for-byte output guard (above).
- A diacritic fixture renders every dictionary string in all four languages at every
  scale step, **in both themes** — the two families differ, so a glyph present in Inter
  is not evidence about Archivo — and fails on a missing glyph.

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

### 10.3 Open — no responsive layout

The original has no `@media` query at any width (§7.8), and the fidelity rule reproduces
that. This is the largest known gap between the product and its audience: §1 records
that four of the five audiences read this on a phone or a projector, and on a phone the
332px rail, the 378px drawer and the 17-column table all overflow.

It is listed here rather than fixed because a responsive layout is a design decision
about what to drop, stack and reorder at each width — the kind of decision this revision
deliberately handed back. It needs its own approval, its own spec section and its own
plan.

*Blocking nothing in this spec; blocking real use on a phone.*

### 10.4 Non-goals

No login, no saved views, no editing, no geocoder beyond the 55 study cities, no time
series (there is no time series in the data), and no backend service.

---

## 11 · Decision log

Revision 2 reverses most of revision 1. Both are recorded: the first column is what
this spec now says, the second is what revision 1 said, so the reversal is auditable
rather than silent.

| Decision | Chosen (rev 2) | Rejected / reverted |
| --- | --- | --- |
| Overall approach | **Pixel-for-pixel rebuild of the original** | A new visual direction ("Field") |
| Theme structure | **Two independent systems, as the original defines them** | One system, two grounds |
| Visual direction | **The original's** | Field; Instrument; Briefing |
| Type | **Inter 500 / Archivo 800, original sizes incl. 9.5px** | Archivo throughout, 11px floor |
| Spacing | **Two scales, 0.7x and 1.0x as declared** | One 4px-based scale |
| Radius | **4/8/14 and 0/0/0 as declared** | Sharp 0/2/4 |
| Headline sentence | **Not adopted** | Adopted from Briefing |
| Rail | **Flat, ten groups** | Three disclosure groups |
| Header | **Unchanged — Export and Framed stay** | Export removed, Framed demoted, density control added |
| Table | **All 17 columns** | 7 default columns with a toggle |
| Compare form | **Per-city cards, 5 cities, national-max scaling** | Transposed matrix, 4 cities, scaled to selection |
| Compare chart | **A1 — horizontal clustered bars, day vs night** | Per-measure single bar (the original); slope chart; A2 |
| Reports | **Brief beside one select + Download** | Six equal export cards (the original) |
| Mobile | **None, as the original** — logged as an open item | A designed responsive layout |
| Map encoding | **One diverging ramp, class in outline** | Two ramps keyed by class |
| Encoding variable | **`lst_rel`** (interim), `gi_z` when available | `suhii` (53.5% agreement) |
| Text colour | **A parallel ink scale, min lightness delta** | Re-authored ramps; a single corrected ramp |
| Ramp fills | **Byte-identical to the original** | Corrected for direction and salience |
| Bar fill | **The original's track-anchored gradients** | Re-specified gradient with a 2px end cap |

Two entries are the user's own adjustments to the original rather than carry-overs from
revision 1, and are kept on that basis: the clustered-bar Compare chart and the Reports
select. Both are flagged at §7.5 and §7.7 so they can be reverted to the original in one
edit if that is not wanted.

---

## 12 · Next step

A rewritten implementation plan replacing
`docs/superpowers/plans/2026-10-13-suhi-app-rebuild.md`, ordered with acceptance
criteria per task, covering: the token layer and the ink derivation, the retarget
deletions in §4.3, the Vite/React/TypeScript/Radix shell, the MapLibre + PMTiles map,
a component-by-component transcription of the original against the fidelity rule in
§3, the correctness fixes in §9, the fidelity and contrast guards in §9.2, and
deployment.

Plan 1 (`2026-10-13-suhi-foundations-and-data.md`) is complete and merged at `5e2f884`.
Its data pipeline, encoding module, dictionary and CI survive this revision unchanged;
its palette generator does not (§4.3).
