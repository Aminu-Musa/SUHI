# Nigeria first-level administrative boundaries

`nga-adm1.topojson` — 37 features (36 states + the Federal Capital Territory), 260 KB.

**Source:** geoBoundaries gbOpen, release `9469f09`, via the Humanitarian Data Exchange record
*Nigeria - Subnational Administrative Boundaries* (last updated 2025-08-26).
**Licence:** Open Database License (ODC-ODbL) — attribution and share-alike.
**Fields:** `shapeName`, `shapeISO`, `shapeID`, `shapeGroup` (ISO country code), `shapeType`.

## Why this file exists

The Protomaps vector basemap (spec §8.3) carries admin-level-1 lines, but its features have
**no country code, name or ISO field at any zoom** — so Niger's, Benin's, Cameroon's and Chad's
first-level divisions render inside Nigeria's bounding box with nothing to filter them out.
That is visible in `shot-task6-*.png`.

This file is Nigeria-only by construction: 37 features, all `shapeGroup: NGA`. It replaces the
basemap's boundaries for the "State boundaries" layer and closes §10.2's long-standing backlog
item, which asked for GRID3 or GADM data.

## Provenance note — read before citing this as GRID3

The user asked for GRID3. **This is geoBoundaries, not GRID3's own layer**, and the distinction
is worth keeping straight:

- GRID3 publishes *NGA - Operational State Boundaries* on its own ArcGIS Hub
  (`data.grid3.org`), dated 2020 and labelled "administrative (non-authoritative)". The page is
  JavaScript-rendered and its FeatureServer URL did not resolve through the Hub API, so it could
  not be fetched programmatically. It can be downloaded by hand from the Hub UI.
- geoBoundaries ADM1 is open, versioned, recently updated, and distributed in exactly the formats
  this project needs.

If GRID3's own operational layer is wanted specifically, drop the GeoPackage in beside this file
and point the loader at it — the shape of the work is identical, only the path changes.
