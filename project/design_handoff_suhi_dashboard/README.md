# Handoff: Nigeria SUHI hot &amp; cold spot dashboard

## Overview

A public-facing dashboard for the 2024 surface urban heat island (SUHI) study of 55
Nigerian cities. It maps 441 Getis-Ord Gi\* contour polygons — hot spots and cold
spots, day and night, at three intensity percentiles — over free basemaps, and reports
the metrics that matter for policy: how many spots, how much area, and how many people
are inside them.

Audience: ministry and state officials, public-health and field programme teams,
researchers, and donor/NGO partners. Four of those five groups will read this on a
phone or a projector, not a GIS workstation.

## About the design files

**The files in this bundle are design references created in HTML.** They are a working
prototype of the intended look and behaviour, not production code to lift wholesale.
The task is to recreate this design in the target codebase's environment using its
established patterns. If there is no environment yet, see *Recommended tech assembly*
below — but note that this prototype is already deployable as-is, and shipping it
unchanged to GitHub Pages is a legitimate v1.

Two things in the bundle **should** be carried across verbatim rather than reimplemented:

1. `styles/nocturne.css` and `styles/modernist.css` — the two design-system token
   sheets. Do not retype the values.
2. The two `html[data-theme]` blocks in the prototype's `<style>` element. These are the
   entire theming mechanism (see *Theming*).

## Fidelity

**High fidelity.** Colours, type, spacing, ramps and interaction states are final and
come from two bound design systems. Recreate them exactly. The two layers explicitly
marked *placeholder* (state boundaries, and city-total population) are the only
knowingly unfinished content.

## Screens / views

### 1. Map (default)

**Purpose.** See where hot and cold spots are, at national or city scale, and read the
headline numbers for whatever is currently in scope.

**Layout.** Full-viewport flex column. Header 54px, fixed. Below it a horizontal flex
row: a 332px left rail (`overflow-y:auto`, `padding: var(--space-6)`, `gap:
var(--space-6)`) and a flexible map stage. The rail is the only scrolling region; the
map fills the rest. A 378px detail drawer slides in from the right edge of the map,
`transform: translateX(100%)` → `none`, 220ms `cubic-bezier(.4,0,.2,1)`.

**Header.** Brand lockup (`SUHI Nigeria` + a muted uppercase 10.5px kicker), then a tab
list, then a spacer, then language `<select>`, theme `<select>`, a *Framed* toggle and
*Export*. All controls 12px, `--radius-sm`, 1px border in Nocturne and 2px in Modernist
(via `--ui-rule`).

**Left rail, in order.**
1. City / spot-ID search with an inline result list.
2. Scope label (`National · 55 cities`, or the city name plus a *reset* link) and the
   KPI grid: hot-spot count, cold-spot count, share of studied area (hot % and cold %
   side by side over a split bar), population inside hot spots, population inside cold
   spots, and a typology-and-confidence line.
3. Confidence distribution — four p-value bins as horizontal bars.
4. Basemap segmented control: Dark / Topo / Relief / Gray / Imagery.
5. Contour level segmented control: L50 / L75 / L90.
6. Layer toggles with a count chip each, plus a fill-opacity slider.
7. **Cluster typology** — a `<select>` listing all 16 occupied clusters as
   `id — Landcover · Elevation band · Geology`, and below it a card giving the selected
   cluster's landcover, elevation, geology, climate, mean SUHI, Sen slope, hot- and
   cold-spot population, and its member cities. With *All typologies* selected the card
   instead ranks the five most common typologies by city count.
8. **Population circles** — a Both / Hot / Cold segmented control and a proportional-
   circle legend at 500 / 5,000 / 23,000 persons.
9. Year slider, 2015–2024.
10. Legend: the hot ramp and cold ramp, each with three tick labels, and a note that a
    dashed outline means not significant after Benjamini–Hochberg correction.
11. A standing note that the three Nigerian-language label sets are a first pass.

**Map stage.** Leaflet, `minZoom 5`, `maxZoom 16`, fitted to Nigeria's bounds on load.
Custom panes, bottom to top: basemap tiles (z-index 100), boundaries (400), day spots
(420), night spots (421), city circles (460), city labels (470, `pointer-events:none`).
A vertical accent-coloured divider at 55% is draggable; the day pane is clipped
`inset(0 <right>px 0 0)` and the night pane `inset(0 0 0 <left>px)`, so dragging wipes
between the two acquisitions of the same place. Corner overlays: title and subtitle top
left over a scrim, and zoom in / zoom out / Fit buttons top right.

**Interactions.** Hover a spot or a city for a tooltip; click a spot for the spot
drawer; click a city, a search hit or a table row to zoom to that city's spot bounds and
open the city drawer. Clicking the map background closes the drawer.

### 2. Compare cities

Up to five cities as pill toggles, then a responsive card grid
(`repeat(auto-fit,minmax(240px,1fr))`, `gap: var(--space-6)`). Each card carries the
city name, its mean SUHI, a physiographic line (landcover · elevation · geology), its
cluster and typology in the accent colour, then eight measures as label / track / value
rows — SUHI intensity, mean LST, max LST, population in hot spots, population in cold
spots, hot-spot area, hot share of city, cold-spot area, warming trend — and a footer
of hot count, cold count and MODIS hot days. Bars scale against the national maximum
for each measure, so lengths compare down a column and not across.

### 3. Data table

One row per city, 17 sortable columns, aggregated from L50 contours only (L75 and L90
are nested inside L50 and would triple-count). Click a heading to sort, click a row to
open that city on the map.

### 4. Reports &amp; export

A 640px city brief — four big numbers, a written paragraph generated from the city's own
figures, and a method note — beside a grid of six export cards: city brief PDF, full
report PDF, spot records CSV, contours GeoJSON, contours TopoJSON, city aggregates CSV.
The buttons are non-functional in the prototype.

## Theming

Both design systems' stylesheets load. The active one is chosen by `data-theme` on
`<html>`, and each theme block re-declares that system's tokens; `html[data-theme=x]`
(specificity 0,1,1) outranks each stylesheet's `:root` (0,1,0). Everything in the UI
reads tokens, so one attribute swap re-skins the whole dashboard including radii, rule
weights and typeface.

| Token | Nocturne | Modernist |
| --- | --- | --- |
| `--color-bg` | `#161826` | `#f3f2f2` |
| `--color-surface` | `#232532` | `#eae9e9` |
| `--color-text` | `#e9e9ed` | `#201e1d` |
| `--color-accent` | `#9184d9` | `#ec3013` |
| `--font-heading` / `--font-body` | Inter 500 | Archivo 800 / 400 |
| `--radius-sm/md/lg` | 4 / 8 / 14px | 0 / 0 / 0px |
| `--space-1…8` | 2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4px | 4 / 8 / 12 / 16 / 24 / 32px |
| `--ui-rule` (border weight) | 1px | 2px |
| `--ui-panel` | `#1c1e2b` | `#eae9e9` |
| `--ui-panel-2` | `#292b31` | `#e2e0e0` |
| `--ui-line` | `#3f424d` | `#201e1d` |
| `--ui-muted` | `#9397ab` | `#605d5d` |

`--ui-*` are local semantic aliases, not design-system tokens: both ramps run dark at
step 900, so `--color-neutral-900` cannot serve as "panel" in both themes.

### Data ramps

Five steps each, deepened in Modernist for contrast on a light ground. Hot maps SUHI
0 → +3.7 °C, cold 0 → −1.65 °C, both `clamp(true)`.

| Step | Nocturne hot | Modernist hot | Nocturne cold | Modernist cold |
| --- | --- | --- | --- | --- |
| 1 | `#f6e08a` | `#e9b420` | `#cfe4f7` | `#a8cfe8` |
| 2 | `#f2c14e` | `#e0902a` | `#8fbfe8` | `#6ba6d8` |
| 3 | `#ec9a3c` | `#d6691f` | `#5793d1` | `#3d79bd` |
| 4 | `#e06b2f` | `#c03c1a` | `#3467ad` | `#23539b` |
| 5 | `#c9382c` | `#8e1408` | `#20407c` | `#12306b` |

Shadows: `--shadow-sm/md/lg` from each system. Nocturne uses a hairline edge plus
ambient darkness; Modernist uses soft ink-tinted drops.

## Localisation

English (default), Hausa, Igbo, Yorùbá. Implemented as a hand-built dictionary object
`D` keyed by string id, each value a four-element array in `['en','ha','ig','yo']`
order, with `T(key)` reading the active index. Chosen over a translation service because
it works offline, needs no API key or quota, and cannot surprise the layout at runtime.

**Deliberately not translated:** city names, all numeric values, and the scientific
vocabulary — SUHI, LST, MODIS, Getis-Ord Gi\*, Sen slope, Mann–Kendall,
Benjamini–Hochberg, contour level names. Translating these would make the dashboard
harder to cross-check against the paper, not easier.

**The Hausa, Igbo and Yorùbá strings are a first pass and must be reviewed by native
speakers before public launch.** Diacritics matter in Yorùbá and Igbo; a wrong tone mark
changes the word. The UI carries a standing note to this effect; remove it once reviewed.

Static strings use `data-i18n="key"` / `data-i18n-ph="key"` attributes and are swapped by
`applyI18n()`; dynamic strings call `T()` inline. Language choice persists in
`localStorage` under `suhi.lang`, theme under `suhi.theme`.

## Data

`data/spots.geojson` — 441 features, MultiPolygon, EPSG:4326, coordinates rounded to
4dp (~11m). 30 retained attributes per feature:

`spot_id`, `city`, `period` (day|night), `spot_type` (hot|cold), `zone`
(bra|urban_core|both), `tier` (1|2), `cluster25`, `contour_level` (L50|L75|L90),
`area_km2`, `population`, `suhii`, `mean_lst`, `max_lst`, `min_lst`, `std_lst`,
`sen_slope_C_per_decade`, `mk_p_value`, `mk_trend`, `n_modis_hot_days`,
`bh_significant`, `dense_core_pct`, `climate_class`, `landcover_class`,
`elevation_class`, `geology_class`, `city_area_km2`, `uc_area_km2`, `persistent_dn`,
`n_persistent_events`, `longest_event_days`, `nb04_val_tier`.

`data/cities.json` — 55 rows, derived. Centroid, hot/cold counts, hot/cold area,
`pop_hot`, `pop_cold`, `pct_hot`, `pct_cold`, mean SUHI, mean/max LST, mean Sen slope,
mean MODIS hot days, city and urban-core area, BH-significant count, persistent count,
dominant landcover / elevation / geology / climate, and dominant `cluster`.

`data/clusters.json` — 16 rows, one per occupied cluster of k=25. `typology` (the
`Landcover · Elevation band · Geology` string), member cities, dominant classes, mean
SUHI and slope, and hot/cold population and area.

Both derived files are generated from the GeoJSON; the generation logic is documented in
`task.md` so it can be reproduced in a build step rather than hand-maintained.

### Aggregation rules that must be preserved

- Counts, areas and populations aggregate **L50 only**. L75 and L90 are nested inside
  L50; summing all three triple-counts.
- The proportional circles use **one shared square-root scale** across hot and cold, so
  equal circle area means equal population. Two scales would make the comparison lie.
- The year slider back-casts: `value(year) = suhii − (2024 − year)/10 ×
  sen_slope_C_per_decade`. This is a modelled projection from a real trend statistic on
  a single-year composite, not observed multi-year data, and the UI says so. If real
  annual composites arrive, replace this and delete the note.

### Known data gaps

- **City-total population is not in the dataset.** Only population inside contours is.
  Joining WorldPop or GRID3 by city would let the circles show city / hot / cold as three
  nested rings, which is what the brief asked for.
- **State boundaries are a placeholder** — currently a 1.6° graticule drawn dashed, so
  the layer toggle and legend are real while the geometry is not. Replace with a real
  admin-1 GeoJSON (GRID3 Nigeria or GADM level 1).
- **Physiographic relief** is served as a real basemap (Esri World Shaded Relief) rather
  than a vector layer. If a physiographic-region polygon file exists, it belongs on the
  `phys` pane at z-index 250.

## Basemaps

All free, no API key, no sign-up. Carto's dark tiles were tried and rejected: they now
watermark unkeyed requests.

| Key | Service | Max native zoom |
| --- | --- | --- |
| `dark` | Esri World Dark Gray Base | 16 |
| `topo` | Esri World Topo Map | 19 |
| `relief` | Esri World Shaded Relief | 13 |
| `gray` | Esri World Light Gray Base | 16 |
| `imagery` | Esri World Imagery | 19 |

`dark` is selected automatically with Nocturne and `topo` with Modernist, until the user
picks one explicitly. Attribution strings are required by the terms of use — keep them.

The national boundary comes from `world-atlas@2.0.2` `countries-110m.json` (Natural
Earth, public domain), converted with `topojson.feature`. It is 1:110m and visibly
coarse past zoom 9 — replace it with the same admin GeoJSON as the state boundaries.

## Recommended tech assembly

The question this handoff exists to answer is *what will keep the look and feel
identical*. The answer is that the look and feel lives in two CSS files and two token
blocks, so any assembly that carries those unchanged will preserve it. Two paths:

**A. Ship the prototype (recommended for v1).** It is already a static site. Rename the
HTML to `index.html`, add an empty `.nojekyll` at the repo root — without it GitHub
Pages' Jekyll step silently drops the `_ds/` directory because of the leading underscore
— and enable Pages on `main` / root. Cloudflare Pages or Netlify avoid that quirk
entirely and give better tile caching and a free custom domain. Total build step: none.

**B. When it outgrows one file: Vite + React + TypeScript + react-leaflet.** Import the
two stylesheets unchanged, keep the `data-theme` attribute mechanism exactly as is,
move the dictionary into `react-i18next` resource bundles with the same keys, keep the
data in `public/data/`, and keep every colour as a `var(--*)` read. Do **not** port the
tokens into a JS theme object or a Tailwind config — that is where the look and feel
would start drifting.

Either way the deployment target is static hosting. There is no backend until you need
logins, saved views, user uploads, unpublished data, or server-side recomputation of
Gi\* from MODIS. When the data outgrows the browser the answer is still not a backend —
it is PMTiles, served as static files from the same host.

## Files in this bundle

- `nigeria-suhi-dashboard.html` — the prototype. Single file, no build step.
- `data/spots.geojson`, `data/cities.json`, `data/clusters.json`
- `styles/nocturne.css`, `styles/modernist.css` — the two token sheets, verbatim
- `concept.md` — what the product is and why it is shaped this way
- `task.md` — the implementation backlog, ordered, with acceptance criteria

Third-party, all pinned with SRI hashes in the prototype's `<head>`: Leaflet 1.9.4,
d3 7.9.0, topojson-client 3.1.0. No other dependencies.
