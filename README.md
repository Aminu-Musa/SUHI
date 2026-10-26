# Nigeria SUHI dashboard

A public dashboard for a 2024 study of surface urban heat islands across 55 Nigerian cities.
Getis-Ord Gi\* on MODIS land surface temperature produced 441 contour polygons — places
measurably hotter than their rural surroundings, and places measurably cooler — at three
nesting percentiles (L50, L75, L90), for two acquisitions (day and night).

## What this repository is

A **pixel-for-pixel rebuild** of `project/nigeria-suhi-dashboard.html` on React + TypeScript +
MapLibre. That file is the design the study's author approved, and it is the authority for
anything visual — including values that look wrong, such as 9.5px labels, two genuinely
independent design systems, and no media queries at any width.

Only four things change from it, each for a measured reason, and all four are listed in §3 of
the spec. Everything else that departs from the original was approved by the user explicitly and
is recorded with its authorisation.

**Start here:**

| | |
| --- | --- |
| The authority | `docs/superpowers/specs/2026-10-14-suhi-dashboard-pixel-rebuild-design.md` |
| The plan | `docs/superpowers/plans/2026-10-14-suhi-pixel-rebuild.md` |
| Every decision taken during the build, and why | `.superpowers/sdd/2026-10-14-suhi-pixel-rebuild/progress.md` |
| The fidelity target | `project/nigeria-suhi-dashboard.html` |

The progress ledger is the most useful of those if something looks odd. Roughly forty rulings are
recorded there, most of them corrections to the spec or plan found while building, each with what
it costs if the decision was wrong.

## Running it

```bash
npm install
npm run dev          # the rebuild, port 5173 unless told otherwise
```

To see the original beside it, serve the repository root — **not `project/`**, because the
prototype fetches `../data/*.json` and those escape a `project/` root and 404:

```bash
node tests/fidelity/server.mjs       # repo root on :5179
# original -> http://127.0.0.1:5179/project/nigeria-suhi-dashboard.html
```

`.claude/launch.json` has both configured.

**The basemap is not in git.** `public/nigeria-z10.pmtiles` is a 39 MB Protomaps extract; rebuild
it with `go-pmtiles`:

```bash
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles public/nigeria-z10.pmtiles \
  --bbox=2.5,3.9,15.0,14.1 --maxzoom=10
```

Production serves a higher-zoom extract from Cloudflare R2 — see spec §8.3 for why Pages cannot
host it.

## Checks

```bash
npm test             # unit and component suites
npm run audit        # WCAG contrast, fails the build under 4.5:1
npm run fidelity     # Playwright: the rebuild against the original, per theme
npm run build
```

`npm run fidelity` is the one that makes "pixel-for-pixel" a requirement rather than an
intention. It compares every declared token and the computed box and type of every styled
selector, in both themes, and fails on any difference outside a list where **every entry cites
the spec section or bug number that permits it**.

## Read this before you trust a green result

The handoff bundle this repository grew from advised: *"Don't render these files in a browser or
take screenshots unless the user asks you to. Everything you need is spelled out in the source."*

**That advice is wrong, and following it cost real time here.** MapLibre's worker silently failed
to load — a template-literal specifier Rollup could not analyse — and **the map drew nothing
while 212 tests, a clean build and a green fidelity guard all passed.** The guard measures the
map container's computed box, and the container was perfectly correct.

The same lesson recurred often enough to be the main thing this repository has to teach:

- A `prefers-reduced-motion` test read an **empty string** for 18,087 characters of CSS, because
  jsdom does not evaluate media queries and Vite's `?raw` returns nothing without `test.css`.
- Six fidelity selectors were deleted from the pending list and compared **nothing**, because they
  only exist while the drawer is open — six deletions reporting six wins.
- The fidelity guard measured **stale `dist` output** for a while, because the build lived in a
  server command that gets skipped when a server is reused. A 2px rail change passed.

So: **run the app and look at it.** Every task that changes something visible ends with a
screenshot. Automated checks prove a thing is correct; they cannot show whether it is there.

## Layout

```
project/            the approved design — the fidelity target, do not edit
data/               spots.geojson plus everything derive.mjs generates from it
data/boundaries/    Nigeria ADM1, 37 features — see its own README for provenance
scripts/            the data pipeline, the palette audit, the ink-scale generator
src/                the rebuild
tests/fidelity/     the guard, its fixtures, and the sanctioned-difference list
docs/superpowers/   the spec and the plan
```

**Every derivation has exactly one owner**, and that is the load-bearing rule of this codebase —
`encode.mjs` owns what colour means, `ink.mjs` owns the text scale, `derive.mjs` owns the
published figures, and one module owns the interpolated ramp. The moment two places compute the
same thing they eventually disagree, and the disagreement surfaces as a number that differs
between tabs.
