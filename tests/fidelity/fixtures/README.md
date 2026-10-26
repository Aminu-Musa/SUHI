# Fidelity fixtures

Both files exist so `npm run fidelity` runs with **no network at all**. A guard that needs the
internet fails randomly, and a guard that fails randomly gets switched off.

## `countries-110m.json`

Stands in for `world-atlas@2.0.2/countries-110m.json`, which the *original* prototype fetches from
a CDN (line 595). Not the real Natural Earth outline — one coarse ring whose extent matches
Nigeria's bounding box, which is all the prototype needs from it (`d3.geoBounds` for the graticule
extent and `fitNation`'s framing).

An **empty** topology is not enough: `.find(f => f.properties.name === 'Nigeria')` then returns
`undefined`, `d3.geoBounds(undefined)` throws inside `initMap` **after** line 600 has removed
`#loading`, and the prototype's own `.catch` then throws too, writing to the element it just
removed. The page looks loaded and renders zero KPIs.

## `nigeria-ci.pmtiles`

**565 KB**, Nigeria bbox `2.5,3.9,15.0,14.1`, **zoom 0–5**. Cut with `go-pmtiles` v1.31.2 from
`build.protomaps.com/20261020.pmtiles`.

This exists because **CI has no basemap**. `public/nigeria-z10.pmtiles` is 39 MB and gitignored;
Vite copies `public/` into `dist/`, so a local fidelity run tests against a real archive while CI
runs against a source that 404s — and still reports green, because the compared selectors resolve
their type and box from CSS rather than from tiles. CI passing while testing less than the dev loop
is the opposite of what the gate is for.

Zoom 5 is deliberate: it is the map's `minZoom` and the zoom `fitNation` lands on, so this fixture
covers the view the guard actually screenshots. It proves the protocol registers, the source
resolves and the basemap renders. It is **not** for looking at — zoom in and there is nothing
there. Local development and production keep the full extracts.

Rebuild either with:

```
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles <out>.pmtiles \
  --bbox=2.5,3.9,15.0,14.1 --maxzoom=<ceiling>
```
