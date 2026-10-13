# Concept

## What this is

A public dashboard for a national study of surface urban heat islands in Nigeria. The
study ran Getis-Ord Gi\* on MODIS land surface temperature across 55 cities for 2024 and
produced 441 statistically defined polygons: places measurably hotter than their rural
surroundings, and places measurably cooler. The dashboard's job is to make those
polygons legible to people who will never open a GIS.

## Who reads it

Four audiences, one screen:

- **Ministry and state officials** want the ranking and the population count. Which
  cities are worst, how many people are inside a hot spot, is it getting worse.
- **Public-health and field programme teams** want to find a specific place. Search a
  city, zoom in, read the numbers for that contour.
- **Researchers** want the attributes and the confidence. p-values, Sen slopes, whether
  a spot survived multiple-comparison correction, which contour percentile they are
  looking at.
- **Donors and NGOs** want the one-page brief they can attach to a memo.

These pull in different directions. The resolution is a single map screen that answers
the first two audiences at a glance, with the third audience's detail one click away in
a drawer and the fourth audience's output on its own tab.

## The argument the design makes

**Heat is a place, not a number.** The map is the primary object and everything else
annotates it. Metrics live in a rail beside the map rather than in a dashboard grid
above it, because a number without its location is not actionable for a programme team.

**Cold spots are findings, not the absence of findings.** They get equal ramp weight,
equal counts, and their own population metric. The cool areas are where the mitigation
evidence is — a park that measurably drops surface temperature is the intervention this
study argues for.

**Day and night are the same place, measured twice.** They are not two datasets to
switch between; the difference between them is the finding. Hence one map with a
draggable wipe rather than a toggle or two panels: the eye reads the change across the
divider, which a toggle destroys and side-by-side panels halve the resolution of.

**Typology explains, geography only locates.** `cluster25` groups the 441 spots into 16
occupied typologies of landcover, elevation band and geology. That is the answer to *why
here* — a cropland-on-basement-complex spot at 200m behaves differently from a built-up
sedimentary spot at sea level, and interventions differ accordingly. So the cluster is
not a filter buried in a menu; it is a named typology with its own card, its own column,
and a place in every tooltip and brief.

**Uncertainty is shown, not hidden.** 25 of 441 contours survive Benjamini–Hochberg
correction. Rather than filter the rest away or present all 441 as equally solid, the
non-significant ones render with a dashed outline and the p-value distribution sits in
the rail. A reader can see both the pattern and how much of it is firm.

**Say what is modelled.** The year slider back-casts from each spot's Sen slope because
the dataset is a single 2024 composite. That is stated in the control itself, not in a
methods appendix.

## Why these visual choices

The colour semantics are fixed by the subject: cold spots grade through blues, hot spots
from yellow through orange to red. This is the one thing in the design that is not a
preference. Both themes carry the same five-step ramps, deepened on the light ground so
the pale end stays readable.

Two themes ship because the audiences use different rooms. Nocturne, dark, is for a
projector in a briefing and for a phone at night; the map's own tiles go dark with it and
the accent works as a line rather than a fill. Modernist, light, is for print, for a
document screenshot, and for the topographic basemap — flat, gridded, red on white, zero
radius. Neither is a "mode" of the other; each is a complete design system, and the
switch is one attribute.

Four Nigerian languages ship because a national public dashboard that only speaks
English is not a national public dashboard. The scientific vocabulary stays in English
so the numbers can be checked against the paper.

## What it deliberately does not do

- No login, no saved views, no per-user state beyond language and theme.
- No time series, because there is no time series in the data yet.
- No basemap search or geocoder — the search is over the 55 study cities, which is the
  whole universe of the dataset.
- No editing. This is a reading instrument.

## Where it goes next

In rough order of value: join city-total population so the proportional circles can show
city / hot / cold as three nested rings; replace the placeholder state boundaries and the
1:110m national outline with real admin geometry; get the language strings reviewed by
native speakers; make the export buttons produce real files; then, only if the data
grows, move the contours to PMTiles.
