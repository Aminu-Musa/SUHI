# Tasks

Ordered. Each task states what done looks like. Tasks marked **blocked** need something
from outside the repo.

---

## 0 · Ship what exists

### 0.1 Deploy the prototype as-is
- Rename `nigeria-suhi-dashboard.html` → `index.html` at the repo root.
- Create an empty `.nojekyll` at the repo root. **Required.** Without it GitHub Pages
  runs Jekyll, which ignores directories beginning with `_`, and `_ds/` — both design
  system stylesheets — silently 404s.
- Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
- **Done when:** the live URL renders the dark theme with tiles, all 441 polygons, and
  no console errors, on a cold load in a private window.

### 0.2 Consider Cloudflare Pages instead
- Same static output, no Jekyll quirk, better tile caching, free custom domain.
- **Done when:** a decision is recorded in the README. Not a code change.

---

## 1 · Data pipeline

### 1.1 Move the derived files into a build step
`data/cities.json` and `data/clusters.json` were generated from `data/spots.geojson`.
They are currently committed as static output. Write `scripts/derive.mjs` that
regenerates both, and run it in CI on any change to the source GeoJSON.

Rules the script must implement, because getting them wrong silently corrupts every
number on screen:
- **Counts, areas and populations aggregate `contour_level === 'L50'` only.** L75 and
  L90 are nested inside L50. Summing all three triple-counts.
- Means (`suhii`, `mean_lst`, `slope`, `hotdays`) are taken over **all** contour levels;
  `max_lst` is a max over all levels.
- City centroid is the unweighted mean of every coordinate of every one of that city's
  features. Good enough for a marker, not a real centroid — do not use it for analysis.
- `pct_hot` = L50 hot area ÷ `city_area_km2` × 100. Same for `pct_cold`.
- Dominant class fields (`landcover`, `elev`, `geol`, `climate`, `cluster`) are the
  modal value by feature count, ties broken by first occurrence.
- Cluster `typology` string = `<dominant landcover> · <elevation band, shortened> ·
  <geology, shortened>`, using the abbreviation maps in the current script.
- **Done when:** running the script on the committed GeoJSON reproduces the committed
  JSON byte-for-byte.

### 1.2 TopoJSON conversion
`spots.geojson` is 930 KB of raw JSON. `geo2topo` + `toposimplify` typically returns
60–80% of that with no visible loss at zoom ≤ 16.
- Emit `spots.topo.json` alongside the GeoJSON; keep both, since the GeoJSON is also a
  published data product.
- Load the TopoJSON in the app and convert with `topojson.feature` (already a
  dependency, already used for the national boundary).
- **Done when:** the payload is under 400 KB and the polygons are pixel-identical at
  zoom 5 through 13.

### 1.3 Publish the data products
The repo will also carry the spot data in other formats (Shapefile, GeoPackage, CSV,
Parquet). Wire the six export cards on the Reports tab to real files.
- **Done when:** every export button downloads a real file, and the CSV and GeoJSON
  exports respect the active contour, cluster and year filters.

### 1.4 **blocked** — join city-total population
The dataset carries population inside contours but no city total, so the proportional
circles can only show hot and cold. Join WorldPop 2024 constrained UN-adjusted counts,
or GRID3 Nigeria settlement extents, to the `city_area_km2` extents.
- Add `pop_city` to `cities.json`.
- Render three nested rings — city (outer, neutral), cold, hot — on the shared sqrt
  scale, and drop the "city totals pending" note from the UI and the dictionary.
- **Done when:** the three-ring circles read correctly for Lagos (largest) and Bonny
  (smallest) without the outer ring swallowing the map.

---

## 2 · Real geometry for the placeholder layers

### 2.1 **blocked** — state boundaries
Currently a 1.6° graticule drawn dashed, so the toggle and legend are honest about being
a placeholder. Replace with real admin-1 polygons — GRID3 Nigeria or GADM level 1.
- Simplify to roughly 1:2m; the current national outline is 1:110m and visibly coarse
  past zoom 9.
- Label states at zoom ≥ 7 on the `labelPane`.
- **Done when:** state lines register against the Esri Topo basemap's own boundaries at
  zoom 8 with no visible offset.

### 2.2 **blocked** — national boundary
Replace the Natural Earth 1:110m outline with the admin-0 boundary from the same source
as 2.1, so the two never disagree.
- **Done when:** the outline holds up at zoom 12 over the Bight of Benin coastline.

### 2.3 **blocked** — physiographic regions
Relief is currently served as a basemap (Esri World Shaded Relief), which is real
physiography but not a queryable layer. If a physiographic-region polygon file exists,
mount it on the `phys` pane (z-index 250) with a categorical fill and add it to the layer
list.
- **Done when:** a spot's drawer can name the physiographic region it sits in, from
  geometry rather than from the `elevation_class` attribute.

---

## 3 · Localisation

### 3.1 **blocked** — native review of Hausa, Igbo and Yorùbá
The dictionary in the prototype is a first pass. Diacritics carry meaning in Yorùbá and
Igbo; a wrong tone mark changes the word.
- Export the dictionary to a reviewable sheet, one row per key, four columns.
- Pay particular attention to: `pop_in_hot`, `pop_in_cold`, `share_area`,
  `cluster_typology`, `top_typologies`, and the long `*_note` strings, which are the
  ones a machine pass would mangle.
- **Done when:** each language has a named reviewer recorded in the repo and the standing
  "first pass" note is removed from the rail.

### 3.2 Move to a real i18n layer if the app is rebuilt
Keep the same keys. `react-i18next` resource bundles map onto the current dictionary
one-to-one.
- **Done when:** switching language re-renders without a full remount and the choice
  still persists to `localStorage` under `suhi.lang`.

### 3.3 Number and date formatting
Currently `d3.format` with a hard-coded comma group separator. Use `Intl.NumberFormat`
with the active locale.
- **Done when:** 137,470 formats correctly in all four locales.

---

## 4 · Interaction and robustness

### 4.1 Mobile layout
The rail is 332px fixed and the map takes the rest — below roughly 720px wide that does
not work. Collapse the rail to a bottom sheet with the KPI block visible and the controls
behind a handle.
- **Done when:** the map screen is usable on a 390 × 844 viewport with hit targets at or
  above 44px.

### 4.2 Keyboard and screen-reader access
Tabs already carry `role="tablist"` / `aria-selected`. Still needed: focus management
into and out of the drawer, an escape-to-close binding, `aria-live` on the KPI block so
scope changes are announced, and keyboard control of the day/night divider (arrow keys,
5% per press).
- **Done when:** the whole map screen is operable without a mouse and the drawer traps
  and restores focus.

### 4.3 Tile failure and offline
Tile services do go down. Add an `onerror` handler on the tile layer that falls back to
the next basemap in the list and shows a quiet notice.
- **Done when:** blocking `server.arcgisonline.com` in devtools leaves the polygons,
  boundaries and every metric fully readable over a plain background.

### 4.4 Deep links
Encode scope in the URL: city, contour level, cluster, year, theme, language, basemap,
divider position. This is what makes a screenshot in a memo reproducible.
- **Done when:** copying the URL after drilling into Ibadan at L90 reopens exactly that
  view.

### 4.5 Draw-to-select
Cut from the prototype. If it comes back, it should select spots by polygon intersection
and rescope the KPI block to the selection, not just filter the map.
- **Done when:** a drawn box over Lagos and Ibadan reports the combined population and
  area of the intersected contours.

---

## 5 · Reports

### 5.1 Real PDF export
The city brief already renders as a fixed 640px block with final typography. Print it
rather than rebuild it: a print stylesheet plus `window.print()` will get most of the way.
- **Done when:** the brief prints to one A4 page with no clipped text in either theme.

### 5.2 Full national report
55 briefs plus a national summary and the method note.
- **Done when:** it generates in under 10 seconds client-side, or is pre-built in CI.

---

## Non-goals

Recorded so they do not get re-litigated: no login or user accounts, no saved views, no
editing, no geocoder beyond the 55 study cities, and no backend service until there is
private data, user uploads, or server-side Gi\* recomputation. If the contour data
outgrows the browser, the answer is PMTiles served statically — not an API.
