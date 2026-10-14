# Nigeria SUHI Dashboard — Pixel Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `project/nigeria-suhi-dashboard.html` as a Vite + React + TypeScript application that is visually indistinguishable from it, with the four corrections in spec §3 and nothing else.

**Architecture:** Two authored token blocks in CSS drive everything; a derived ink scale carries all text colour. React components transcribe the original's DOM one-for-one, with Radix supplying only behaviour. MapLibre replaces Leaflet behind the same controls. A Playwright fidelity guard compares the rebuild to the original, per theme, and fails on any difference outside the allowed set.

**Tech Stack:** Vite, React 18, TypeScript, Radix UI, MapLibre GL JS v6, PMTiles/Protomaps, Observable Plot, TanStack Table, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-suhi-dashboard-pixel-rebuild-design.md`

Replaces `docs/superpowers/plans/2026-10-13-suhi-app-rebuild.md`, which planned the abandoned "Field" redesign. Plan 1 (`2026-10-13-suhi-foundations-and-data.md`) is complete and merged at `5e2f884`; its data pipeline, `encode.mjs`, dictionary and CI are consumed here unchanged.

## Global Constraints

Every task's requirements implicitly include these. Values are copied verbatim from the spec.

- **The fidelity rule (§3).** The original is the specification for everything visual. Layout, type, spacing, radius, rules, surfaces and ramp fills are copied exactly. Only four things change: the encoding variable, the ramp direction, text colour (the ink scale), and the accent fill. A change not in §3's "Changed" table and not in §9 is out of scope.
- **Two independent design systems (§3.1).** Nocturne uses Inter 500, a 0.7× spacing scale and 4/8/14px radii; Modernist uses Archivo 800, a 1.0× scale and 0/0/0. No rule may assume they share anything. Every visual test runs twice, once per theme.
- **Token values are authored, never generated.** The two blocks in spec §4.1 and §4.2 are the authority, byte-for-byte.
- **The original's rendered page includes two vendored design-system stylesheets**, and the fidelity target is the rendered page, not the inline `<style>` block alone. `project/nigeria-suhi-dashboard.html` lines 9–10 load `project/_ds/nocturne-*/styles.css` (294 lines) then `project/_ds/modernist-*/styles.css` (252 lines). **Both are unscoped** — each declares `:root` and global element rules (`body`, `h1`–`h6`, `a`, `p`, `:focus`) with no `html[data-theme]` guard. So by load order the *Modernist* base rules win in **both** themes, and the prototype's `html[data-theme]` blocks then override the tokens per theme at higher specificity. That cascade is an accident of load order rather than a decision, but it is what the approved page renders, so it is reproduced exactly: both files are vendored in the same order, ahead of our own CSS. See "Findings while planning" below.
- **The ink scale is derived, never hand-written.** All 22 values (11 token names per theme) come from the fill values through `scripts/lib/color.mjs`. A test regenerates them and asserts equality with the CSS.
- **Original font sizes are kept**, including 9.5px and 10px labels. There is no minimum font size in this project.
- **No Tailwind, no shadcn/ui, no JS theme object.** Styling is our own CSS with custom properties. Radix is used unstyled.
- **No new `@media` query.** The original has none (§7.8). Responsive layout is deferred to §10.3.
- **Counts, areas and populations aggregate L50 only.** L75 and L90 nest inside L50.
- **`buildReferenceMeans` is called on the UNFILTERED feature set**, once, at load. Calling it on a filtered set changes every city's reference mean.
- **`encodeValue` returns `null`** where a spot has no reference mean. MapLibre's `interpolate` does not accept `null`.
- Four languages: English, Hausa, Igbo, Yorùbá. Node 22. Deploys to Cloudflare Pages as a static site.

## Review Focus

Five failure modes the spec implies that no task's own deliverable would naturally exercise. Each has its test pinned to the task that owns the code.

1. **`encodeValue` returns `null` for 2 of 441 features** (`Bida|night` has no reference mean), and a raw `['interpolate', …]` on `null` produces an undefined paint value rather than an error — a silently mis-coloured polygon. Pinned in Task 6.
2. **Values outside the ±4.5 domain must clamp, not extrapolate.** Observed `lst_rel` runs −5.95 to +6.65, so roughly 5% of spots are outside the domain. An unclamped scale sends them past the ramp ends. Pinned in Task 6.
3. **Switching language must not desync control state.** This is the original's bug #2 (`buildRail()` hardcodes `data-on="true"`). A React rebuild reintroduces it the moment any control derives its checked state from a re-rendered label rather than from state. Pinned in Task 5.
4. **Switching theme must re-apply map paint.** MapLibre paint values are resolved when set, not re-read from CSS on an attribute change, so a `data-theme` flip repaints the chrome and leaves the map on the old palette. Pinned in Task 7.
5. **A filter combination that selects zero spots** (a contour level plus a cluster with no members) must render empty KPIs, not `NaN`, `Infinity` or a division by zero. Pinned in Task 4.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/styles/suhi-tokens.css` | The two authored token blocks (§4.1, §4.2), rewritten |
| `src/styles/ink.css` | The derived ink scale — generated, committed, guarded |
| `src/styles/app.css` | The original's rules, transcribed, token-driven |
| `src/styles/print.css` | Print stylesheet |
| `scripts/lib/ink.mjs` | `deriveInk` — the ink scale's single source of truth |
| `scripts/lib/tokens.mjs` | `THEME_TOKENS` as the two authored blocks (rewritten) |
| `scripts/ink.mjs` | Emits `src/styles/ink.css` from `deriveInk` |
| `scripts/audit-contrast.mjs` | Retargeted: 2 themes × 3 grounds × every text token |
| `src/app/App.tsx` | Shell: header, tabs, body, panel switching |
| `src/app/ThemeProvider.tsx` | `data-theme` attribute + the map's repaint signal |
| `src/app/I18nProvider.tsx` | Language state over `src/i18n/dictionary.mjs` |
| `src/app/state.ts` | The `state` object from the original, typed, plus URL sync |
| `src/rail/*.tsx` | One component per rail group (Tasks 4, 5) |
| `src/map/MapStage.tsx` | MapLibre instance, lifecycle, controls |
| `src/map/style.ts` | Style JSON + the spot paint expressions |
| `src/map/interactions.tsx` | Swipe, tooltip, drawer, city circles |
| `src/views/Compare.tsx` | Compare tab |
| `src/views/Table.tsx` | Data table tab |
| `src/views/Reports.tsx` | Reports tab |
| `tests/fidelity/*.spec.ts` | The Playwright fidelity guard |

**Deleted** in Task 1: `scripts/palette.mjs`, `scripts/palette.test.mjs`, `scripts/lib/ramps.mjs`, `scripts/lib/ramps.test.mjs`, `src/styles/_ramps.css`.

---

## Task 1: Token layer, ink derivation, retargeted audit

Everything downstream reads these files, so this task lands first and alone.

**Files:**
- Rewrite: `scripts/lib/tokens.mjs`, `scripts/audit-contrast.mjs`, `scripts/audit-contrast.test.mjs`, `src/styles/suhi-tokens.css`
- Create: `scripts/lib/ink.mjs`, `scripts/lib/ink.test.mjs`, `scripts/ink.mjs`, `src/styles/ink.css`
- Delete: `scripts/palette.mjs`, `scripts/palette.test.mjs`, `scripts/lib/ramps.mjs`, `scripts/lib/ramps.test.mjs`, `src/styles/_ramps.css`
- Modify: `package.json` (drop `palette`, add `ink`)

**Interfaces:**
- Consumes: `hexToOklch`, `oklchToHex`, `contrastRatio` from `scripts/lib/color.mjs` (hue in **radians** in both directions); `deepFreeze` from `scripts/lib/freeze.mjs`
- Produces:
  - `THEME_TOKENS: { nocturne: Record<string,string>, modernist: Record<string,string> }` — the two blocks from spec §4.1/§4.2 verbatim
  - `TEXT_GROUNDS = ['--color-bg', '--ui-panel-2', '--ui-tip']`
  - `deriveInk(hex, { grounds, dir, floor }) -> { hex, moved }` — minimum OKLCH lightness move clearing `floor` on every ground; `dir` is `+1` for Nocturne, `-1` for Modernist
  - `INK_TOKENS(theme) -> Record<string,string>` — all 11 ink values for one theme
  - `auditPairs() -> Row[]` with `id` of the form `theme/--token@--ground`

- [ ] **Step 1: Write the failing tests for `deriveInk`**

```js
// scripts/lib/ink.test.mjs
test('holds hue and chroma, moves only lightness', …)              // ΔH < 1e-9, ΔC < 1e-9
test('returns the input unchanged when it already clears the floor', …)
test('nocturne lightens and modernist darkens', …)
test('clears the floor on every ground, not just the worst one', …)
test('derives 11 ink tokens per theme, 22 in all, matching spec §5.4 exactly', …)
```

The last test is the one that matters; it carries the full expected table:

| Nocturne | | Modernist | |
| --- | --- | --- | --- |
| `--hot-1-ink` | `#f6e08a` | `--hot-1-ink` | `#8b5900` |
| `--hot-2-ink` | `#f2c14e` | `--hot-2-ink` | `#9b5000` |
| `--hot-3-ink` | `#ec9a3c` | `--hot-3-ink` | `#ac4200` |
| `--hot-4-ink` | `#e67035` | `--hot-4-ink` | `#b83410` |
| `--hot-5-ink` | `#f56251` | `--hot-5-ink` | `#8e1408` |
| `--cold-1-ink` | `#cfe4f7` | `--cold-1-ink` | `#45687f` |
| `--cold-2-ink` | `#8fbfe8` | `--cold-2-ink` | `#2d6896` |
| `--cold-3-ink` | `#5a96d4` | `--cold-3-ink` | `#2965a8` |
| `--cold-4-ink` | `#5e93dc` | `--cold-4-ink` | `#23539b` |
| `--cold-5-ink` | `#6d92d5` | `--cold-5-ink` | `#12306b` |
| `--accent-ink` | `#9386dc` | `--accent-ink` | `#cb0000` |

Search step is `0.002` in OKLCH L, starting at `0` (so an already-passing colour returns `moved: 0`). A different step size yields different hex values and fails this test — the step is part of the contract.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/lib/ink.test.mjs`
Expected: FAIL — `deriveInk` is not defined.

- [ ] **Step 3: Implement `deriveInk` and `INK_TOKENS` in `scripts/lib/ink.mjs`**

- [ ] **Step 4: Rewrite `scripts/lib/tokens.mjs`**

`THEME_TOKENS` becomes the two authored blocks, deep-frozen. Delete `SCALE_TOKENS` and `DENSITY` — two independent scales are declared per theme in CSS, and the density control was a revision-1 feature (spec §11).

- [ ] **Step 5: Write `src/styles/suhi-tokens.css` from the spec blocks**

Both blocks exactly as spec §4.1 and §4.2 print them, plus `--accent-fill` per spec §5.6 (`#796bbe` Nocturne, `#e52706` Modernist) and `--neutral-mid` per spec §6.2 (`var(--color-neutral-800)` Nocturne, `var(--color-neutral-400)` Modernist). The original's `--color-neutral-*` scales (prototype lines 22–24 and 43–45) are copied across too — `.bar`, `.sw` and `.cbar .track` reference them.

- [ ] **Step 6: Write `scripts/ink.mjs` to emit `src/styles/ink.css`, and a test that the committed file matches**

```js
// scripts/lib/ink.test.mjs
test('committed ink.css matches a fresh derivation', …)
```

This is the guard that makes a hand-edited ink token fail the build.

- [ ] **Step 7: Retarget `scripts/audit-contrast.mjs`**

- `GROUNDS = ['--color-bg', '--ui-panel-2', '--ui-tip']`
- Text tokens: `--color-text`, `--ui-muted`, `--accent-ink`, and all ten `*-ink` steps — per theme, both themes.
- `TEXT_FLOOR = 4.5`. The 3.0 large-text floor applies to exactly one pair, `.kpi .val`, which is already covered because the ink scale clears 4.5 everywhere; assert the floor constant is 4.5 and that no row is exempted.
- `--accent-fill` is audited in the other direction: `#ffffff` **on** it, floor 4.5.
- `--color-accent` is **not** a text token any more (`--accent-ink` replaced it); assert it is absent from the text set, so a regression that puts raw accent back into text fails.
- Exits 1 on any failure. Row ids stay `theme/--token@--ground`.

- [ ] **Step 8: Rewrite `scripts/audit-contrast.test.mjs`**

```js
test('audits both themes', …)                                   // every row id starts nocturne/ or modernist/
test('audits every ink token on every text ground', …)          // 2 × 13 × 3 = 78 text rows
test('fails when any pair is below 4.5', …)                     // via overrides, mutating one token
test('white on --accent-fill is audited and passes', …)
test('--color-accent is not audited as a text token', …)
```

- [ ] **Step 9: Delete the retargeted-away files and run everything**

Run: `npm test && npm run audit && npm run ink`
Expected: all tests pass; audit exits 0; `ink.css` unchanged by regeneration.

Deleting `ramps.test.mjs` resolves the two hazards parked under ruling 24 (spec §4.3) — they are removed with the generated palette they guarded, not fixed.

- [ ] **Step 10: Commit**

```bash
git add -A scripts src/styles package.json
git commit -m "feat: authored token blocks, derived ink scale, retargeted audit"
```

---

## Task 2: Vite + React + TypeScript scaffold and the app shell

**Files:**
- Create: `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/app/App.tsx`, `src/app/ThemeProvider.tsx`, `src/app/I18nProvider.tsx`, `src/app/state.ts`, `src/styles/app.css`
- Test: `src/app/App.test.tsx`, `src/app/I18nProvider.test.tsx`
- Modify: `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `D`, `LANGS`, `T` from `src/i18n/dictionary.mjs`; the CSS from Task 1
- Produces:
  - `useTheme() -> { theme: 'nocturne' | 'modernist', setTheme, paintEpoch: number }` — `paintEpoch` increments on every theme change and is what Task 7 subscribes to
  - `useT() -> (key: string) => string` and `useLang() -> { lang, setLang }`
  - `useAppState() -> [State, (patch: Partial<State>) => void]` where `State` types the original's `state` object (prototype lines 572–574): `contour: 'all'|'L50'|'L75'|'L90'`, `year: number`, `cluster: string`, `opacity: number`, `city: string|null`, `popMode: 'both'|'hot'|'cold'`, `circleMetric: 'pop'|'area'`, `layers: Record<'spots'|'exag'|'cities'|'states'|'nation'|'labels', boolean>`
  - `type Tab = 'map' | 'compare' | 'table' | 'report'`

- [ ] **Step 1: Scaffold Vite + React + TS and install dependencies**

```bash
npm i react react-dom maplibre-gl pmtiles @radix-ui/react-tabs @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-select @radix-ui/react-dialog @radix-ui/react-toggle-group @radix-ui/react-collapsible @observablehq/plot @tanstack/react-table d3
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @testing-library/react @testing-library/user-event jsdom @playwright/test
```

Pin every dependency to an exact version. Add scripts: `dev`, `build`, `preview`, `fidelity`. Keep `test`, `derive`, `audit`, `ink`.

- [ ] **Step 2: Write the failing shell tests**

```tsx
// src/app/App.test.tsx
test('renders the four tabs in the original order', …)       // Map, Compare cities, Data table, Reports
test('renders brand, language select, theme select, Framed toggle, Export button', …)
test('only the selected tab panel has data-on=true', …)
test('the rail stays mounted on every tab', …)
test('Framed toggle sets data-framed on the stage', …)

// src/app/I18nProvider.test.tsx
test('switching language retranslates every data-i18n key', …)
test('falls back to English for a key missing in another language', …)
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/app`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the shell**

`index.html` loads, in this exact order: `src/styles/vendor/nocturne.css`, `src/styles/vendor/modernist.css` (copied verbatim from `project/_ds/*/styles.css`), `suhi-tokens.css`, `ink.css`, `app.css`. The two vendored files carry the Google Fonts `@import`s that supply the typefaces — Inter 400/500/600/700 and Archivo 400/600/800 — so there is no separate font link to add, and changing how the fonts load is a fidelity risk, not a cleanup.

`App.tsx` transcribes the original's `header.top`, `.body`, `.stage` and the three `.panel` sections (prototype lines 244–395). Tabs use Radix `Tabs` with `asChild` so the rendered markup keeps the original's `.tab` / `role="tab"` / `aria-selected` shape. Language and theme selects use Radix `Select` styled as `.mini-sel`.

`ThemeProvider` sets `document.documentElement.dataset.theme` and nothing else — the CSS does the rest. It also exposes `paintEpoch`; the map is the only consumer, because it is the only thing that does not re-read CSS automatically.

- [ ] **Step 5: Vendor the two `_ds` stylesheets and transcribe the original's CSS**

Copy `project/_ds/nocturne-*/styles.css` and `project/_ds/modernist-*/styles.css` into `src/styles/vendor/` **unmodified**. Do not scope them to a theme, do not deduplicate their overlapping `:root` blocks, and do not reorder them — the Modernist base winning in both themes is the behaviour being reproduced (see Global Constraints).

Then `src/styles/app.css` takes the prototype's `<style>` block (lines 20–241) minus the two `html[data-theme]` blocks, which Task 1 owns. Every rule copied as-is. Two edits only, both from spec §3's Changed table:
- `.seg button[aria-pressed=true]` background becomes `var(--accent-fill)`
- `.kpi.hot .val` / `.kpi.cold .val` become `var(--hot-4-ink)` / `var(--cold-4-ink)`

- [ ] **Step 6: Run the tests, then build**

Run: `npx vitest run src/app && npm run build`
Expected: PASS; build emits static output.

- [ ] **Step 7: Extend CI to run the build**

Add a `npm run build` step and an `npm run audit` step to `.github/workflows/ci.yml` after `npm test`.

- [ ] **Step 8: Commit**

---

## Task 3: The fidelity guard

This lands before any component work so Tasks 4–10 are each checked against the original as they are written. Without it, §3 is an intention.

**Files:**
- Create: `playwright.config.ts`, `tests/fidelity/tokens.spec.ts`, `tests/fidelity/boxes.spec.ts`, `tests/fidelity/allowed-diffs.ts`

**Interfaces:**
- Produces: `ALLOWED_DIFFS: { tokens: string[], selectors: string[] }` — the only sanctioned departures, drawn from spec §3's Changed table. Tasks 4–10 may add to it **only** by citing the spec section that permits the entry.

- [ ] **Step 1: Write the guard**

Two fixtures load the original (`project/nigeria-suhi-dashboard.html`, served statically) and the rebuild (`npm run preview`) at a fixed 1440×900 viewport, once per theme.

```ts
// tests/fidelity/tokens.spec.ts
test('every custom property on :root matches the original', …)

// tests/fidelity/boxes.spec.ts
test('every named element has the original computed box', …)   // x, y, width, height within 0.5px
test('every named element has the original computed type', …)  // font-family, size, weight, letter-spacing
```

The named elements are spec §7.1's tree plus every selector the original's CSS defines a box for: `.top`, `.brand`, `.tabs`, `.tab`, `.rail`, `.sec-h`, `.search`, `.kpis`, `.kpi`, `.kpi .lab`, `.kpi .val`, `.kpi .sub`, `.bar`, `.rowlist`, `.rw`, `.layers`, `.ly`, `.sw`, `.seg`, `.seg button`, `.ramp`, `.rampL`, `.note`, `.stage`, `.mapwrap`, `.mapttl`, `.mapsub`, `.zbtn`, `.tip`, `.drawer`, `.pill`, `.rule`, `.panel`, `.panel h2`, `.lede`, `table.dt th`, `table.dt td`, `.cmp`, `.card2`, `.cbar`, `.picker`, `.pk`, `.brief`, `.expgrid`.

- [ ] **Step 2: Run it against the original twice to prove the harness, not the rebuild**

Run: `npm run fidelity -- --grep "matches the original"` with both fixtures pointed at the original.
Expected: PASS with zero diffs. A harness that cannot tell the original from itself proves nothing.

- [ ] **Step 3: Run it against the Task 2 shell**

Expected: the header and shell pass; rail and panel selectors report missing elements. Record that list in the ledger as the task's starting debt — Tasks 4–10 each close part of it.

- [ ] **Step 4: Commit**

---

## Task 4: Rail groups 1–5

**Files:**
- Create: `src/rail/Rail.tsx`, `src/rail/Search.tsx`, `src/rail/Kpis.tsx`, `src/rail/Confidence.tsx`, `src/rail/BasemapSeg.tsx`, `src/rail/ContourSeg.tsx`, `src/rail/Seg.tsx`
- Test: `src/rail/Kpis.test.tsx`, `src/rail/Seg.test.tsx`, `src/rail/Search.test.tsx`

**Interfaces:**
- Consumes: `useAppState`, `useT` (Task 2); `cities.json`, `clusters.json`
- Produces: `<Seg options values onChange>` — the original's `.seg` as a Radix `ToggleGroup`, rendering `button[aria-pressed]` exactly as the original does. Tasks 5 and 8 reuse it.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/rail/Seg.test.tsx
test('renders aria-pressed=true on exactly the active option', …)
test('is operable by keyboard', …)

// src/rail/Kpis.test.tsx
test('renders the original six tiles with .lab, .val and .sub', …)
test('the hot and cold figures use the ink tokens', …)
test('a filter selecting zero spots renders an em dash, not NaN', …)   // Review Focus 5
test('KPI share bar width is proportional to the share', …)            // spec §9.1 bug 5
test('scope label and reset reflect the selected city', …)

// src/rail/Search.test.tsx
test('matches a city by name and a spot by id', …)
test('matches a city name with diacritics typed without them', …)
```

Review Focus 5 is the load-bearing one: assert `pctHot`, `pop_hot` and the share bar all render `—` when the filtered set is empty, and that no rendered text contains `NaN` or `Infinity`.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement groups 1–5**

Transcribe the original's `buildRail()` (lines 958–1019) and `renderKPIs()` (1028–1068) for these five groups. Two corrections from spec §9.1 apply here: bug 5 (the `Math.min(50, pctHot*6)` share bar) and bug 7 (the "Typology & confidence" tile missing a `.val`).

- [ ] **Step 4: Run tests and the fidelity guard for the rail selectors**

Run: `npx vitest run src/rail && npm run fidelity -- --grep rail`

- [ ] **Step 5: Commit**

---

## Task 5: Rail groups 6–10

**Files:**
- Create: `src/rail/Layers.tsx`, `src/rail/ClusterSelect.tsx`, `src/rail/PopCircles.tsx`, `src/rail/YearSlider.tsx`, `src/rail/Legend.tsx`
- Test: `src/rail/Layers.test.tsx`, `src/rail/PopCircles.test.tsx`, `src/rail/Legend.test.tsx`

**Interfaces:**
- Consumes: `Seg` (Task 4), `useAppState`, `useT`
- Produces: nothing new; the map (Task 6) reads `state.layers`, `state.opacity`, `state.year`, `state.popMode`, `state.circleMetric`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/rail/Layers.test.tsx
test('each layer toggle reflects state.layers, not a hardcoded attribute', …)   // Review Focus 3
test('switching language leaves every toggle state unchanged', …)              // Review Focus 3
test('toggles are role=switch with aria-checked and keyboard-operable', …)      // spec §9.1 bug 3
test('opacity slider updates the percentage label', …)

// src/rail/PopCircles.test.tsx
test('metric and scope segments are independent', …)
test('legend radii follow the population scale', …)

// src/rail/Legend.test.tsx
test('hot and cold ramps render all ten FILL tokens, not ink tokens', …)
test('the legend names the encoded variable in plain language', …)              // spec §6.3
```

Review Focus 3 is the load-bearing one. The second test renders, flips every toggle to a non-default state, switches language, and asserts every `aria-checked` is unchanged. Bug 2 in the original was exactly this.

The legend test pins spec §6.3's requirement that the legend reads "warmer or cooler than the rest of this city" rather than naming `lst_rel`, and that it uses fill tokens — the legend is a swatch, so ink would be wrong.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement groups 6–10**

Layer toggles become Radix `Switch` with `asChild`, keeping the original's `.ly` / `.sw` markup and the `data-on` attribute the CSS targets — but `data-on` is now derived from state. `#opacity` and `#year` become Radix `Slider`; `#cluster` becomes Radix `Select` styled as `.search`.

- [ ] **Step 4: Run tests and the fidelity guard**

- [ ] **Step 5: Commit**

---

## Task 6: MapLibre map — basemap and spot encoding

The largest task, and the one carrying three of the five Review Focus items.

**Files:**
- Create: `src/map/MapStage.tsx`, `src/map/style.ts`, `src/map/expressions.ts`
- Test: `src/map/expressions.test.ts`
- Add: `public/basemap.pmtiles` (or a documented remote URL)

**Interfaces:**
- Consumes: `buildReferenceMeans`, `encodeValue`, `ENCODE_DOMAIN`, `ENCODE_FIELD` from `src/lib/encode.mjs`; `data/spots.topo.json`; `THEME_TOKENS` (Task 1)
- Produces:
  - `spotFillExpression(theme) -> maplibregl.ExpressionSpecification`
  - `spotLineExpressions(theme) -> { color, width, dasharray }`
  - `<MapStage />`

- [ ] **Step 1: Write the failing expression tests**

```ts
// src/map/expressions.test.ts
test('null lst_rel resolves to the neutral midpoint, not an interpolate error', …)   // Review Focus 1
test('values beyond ±4.5 clamp to the ramp ends', …)                                 // Review Focus 2
test('the fill ramp uses the FILL tokens in diverging order', …)                      // spec §6.2
test('outline colour encodes spot_type, not magnitude', …)                            // spec §6.3
test('outline is dashed when bh_significant is false', …)
test('outline width interpolates with zoom', …)
test('reference means are built from the unfiltered feature set', …)
```

Review Focus 1's test asserts the generated expression has the shape

```js
['case', ['==', ['get','lst_rel'], null], <neutral-mid>, ['interpolate', …]]
```

and evaluates it against a feature with `lst_rel: null` — `Bida|night` is the real case, 2 of 441 features today.

Review Focus 2's test feeds `-5.95` and `+6.65` (the observed min and max) and asserts the result equals the `-4.5` and `+4.5` stops exactly.

The last test is a regression guard with teeth: build reference means from the full 441, then from a contour-filtered subset, and assert the two differ — then assert the component calls the unfiltered form.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement the expressions**

The diverging ramp per spec §6.2: `--cold-5 … --cold-1`, `--neutral-mid`, `--hot-1 … --hot-5` over `[-4.5, +4.5]`. Resolve token names to values through `THEME_TOKENS` at expression-build time, not `getComputedStyle` — the map needs concrete colours and a theme argument, which is also what makes Task 7's repaint possible.

- [ ] **Step 4: Implement `MapStage` and the PMTiles basemap**

Register the PMTiles protocol, build the style JSON from tokens so the basemap flips with the theme (spec §8.3), and add the spot source from `spots.topo.json`. The original's `renderSpots()` / `clearLayers()` cycle disappears: filtering becomes `setFilter`, opacity becomes `setPaintProperty`.

The original's geometry exaggeration (`exaggerate()`, `EXAG`) was a Leaflet workaround for small polygons at low zoom. Replace it with a zoom-interpolated outline width (spec §6.3) and keep the `exag` layer toggle wired to that, so the control the user sees still does something. Note this in the ledger as a behaviour substitution, not a visual change.

- [ ] **Step 5: Run tests and the fidelity guard for the map stage**

- [ ] **Step 6: Commit**

---

## Task 7: Map interactions — circles, swipe, tooltip, drawer

**Files:**
- Create: `src/map/interactions.tsx`, `src/map/CityCircles.tsx`, `src/map/Swipe.tsx`, `src/map/Tooltip.tsx`, `src/map/Drawer.tsx`
- Test: `src/map/Drawer.test.tsx`, `src/map/Tooltip.test.tsx`, `src/map/theme-repaint.test.ts`

**Interfaces:**
- Consumes: `paintEpoch` from `useTheme` (Task 2); the map instance from Task 6
- Produces: `focusCity(name: string)` — called by Task 9's row click

- [ ] **Step 1: Write the failing tests**

```ts
// src/map/theme-repaint.test.ts
test('changing theme re-applies every paint property', …)        // Review Focus 4
test('paint after a theme change matches a fresh build in that theme', …)
```

```tsx
// src/map/Drawer.test.tsx
test('opens with the spot record and closes on Escape', …)
test('traps focus while open and restores it on close', …)
test('numeric rows use the ink tokens', …)
test('population bar is proportional, not divided by 230', …)    // spec §9.1 bug 4
test('announces the opened spot via aria-live', …)               // spec §9.1 bug 8
```

Review Focus 4's second test is the one that catches the real bug: snapshot every layer's paint, switch theme, snapshot again, and compare against a map built fresh in the target theme. Equality is the assertion. A `data-theme` flip alone leaves the map on the old palette and fails it.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement the interactions**

Drawer becomes a non-modal Radix `Dialog` keeping the original's `.drawer` markup and `data-open` attribute. Tooltip stays the original's single `#tip` element. City circles become a MapLibre circle layer with the original's `popScale()`. Swipe keeps the original's 2px handle and the two `.swipetag`s, clipping the day and night layers.

Two corrections from spec §9.1: bug 4 (the magic `230`) and bug 6 (the unclipped state graticule — clip to the Nigeria outline).

Subscribe to `paintEpoch` and re-apply paint on change. This is Review Focus 4's fix.

- [ ] **Step 4: Run tests and the fidelity guard**

- [ ] **Step 5: Commit**

---

## Task 8: Compare tab

**Files:**
- Create: `src/views/Compare.tsx`, `src/views/ClusteredBars.tsx`
- Test: `src/views/Compare.test.tsx`

**Interfaces:**
- Consumes: `Seg` (Task 4), `cities.json`
- Produces: nothing downstream

- [ ] **Step 1: Write the failing tests**

```tsx
// src/views/Compare.test.tsx
test('picker allows up to five cities and no more', …)
test('cards lay out in the original auto-fit minmax(240px, 1fr) grid', …)
test('each measure renders two bars, day and night', …)        // spec §7.5
test('bars scale against the national maximum, not the selection', …)
test('bar fills use the original track-anchored gradients', …)
test('values beside the bars use the ink tokens', …)
test('a measure with a null night value renders one bar and a dash', …)
```

The scaling test is the one to get right: select two mid-ranked cities only, and assert Lagos's absolute national maximum still sets the scale — so neither selected bar fills the track. Rescaling to the selection was a revision-1 change the spec reverts (§7.5).

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement Compare**

The original's `renderCompare()` (lines 1071–1102) with one change from spec §7.5: each `.cbar` row becomes two bars, day against night, inside the same `.card2`. The card's surface, padding, radius and 11.5px row type are unchanged.

- [ ] **Step 4: Run tests and the fidelity guard**

- [ ] **Step 5: Commit**

---

## Task 9: Data table tab

**Files:**
- Create: `src/views/Table.tsx`
- Test: `src/views/Table.test.tsx`

**Interfaces:**
- Consumes: `focusCity` (Task 7), `cities.json`
- Produces: nothing downstream

- [ ] **Step 1: Write the failing tests**

```tsx
// src/views/Table.test.tsx
test('renders all 17 columns in the original order', …)
test('sorts numerically on a numeric column and lexically on a string column', …)
test('clicking a sorted heading reverses the direction', …)
test('clicking a row switches to the map tab and focuses that city', …)
test('the five coloured columns use the ink scale', …)          // spec §7.6
test('the suhii column interpolates the hot INK ramp', …)
test('a null cell renders an em dash', …)
```

The 17 columns, in order: `city`, `hot`, `cold`, `suhii`, `mean_lst`, `max_lst`, `pop_hot`, `pop_cold`, `area_hot`, `pct_hot`, `area_cold`, `slope`, `hotdays`, `cluster`, `landcover`, `elev`, `geol`.

The ink test covers `hot` (`--hot-4-ink`), `cold` (`--cold-4-ink`), `suhii` (the interpolated hot ink scale), `slope` (`--hot-3-ink` / `--cold-3-ink`) and `cluster` (`--accent-ink`). The `suhii` column is the one that uncovered the whole ink-scale requirement (spec §5.3) — it interpolates every step, so a fill-scale regression there is the failure the spec was rewritten around.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement the table**

TanStack Table for sorting, rendering the original's `table.dt` markup. The original's `renderTable()` is lines 1105–1130. Default sort stays `suhii` descending.

- [ ] **Step 4: Run tests and the fidelity guard**

- [ ] **Step 5: Commit**

---

## Task 10: Reports tab

**Files:**
- Create: `src/views/Reports.tsx`, `src/lib/export.ts`
- Test: `src/views/Reports.test.tsx`, `src/lib/export.test.ts`

**Interfaces:**
- Consumes: `useAppState` (for the active filters), `cities.json`, `clusters.json`
- Produces: `buildExport(format, rows, filters) -> Blob`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/views/Reports.test.tsx
test('brief renders at the original 640px in the original surface', …)
test('Download button is absent until a format is chosen', …)   // spec §7.7
test('choosing a format reveals Download', …)
test('export carries the active contour, cluster and year filters', …)
```

```ts
// src/lib/export.test.ts
test('CSV quotes a field containing a comma', …)
test('CSV is UTF-8 with diacritics intact', …)
test('GeoJSON export is valid and carries the filtered features only', …)
```

The CSV diacritics test matters because city and typology strings carry them and an export is the one place the data leaves our fonts: assert the bytes round-trip `Yorùbá` and `101–500 m` (an en dash, `e2 80 93`).

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement Reports**

The original's `renderReport()` (lines 1132–1169) with one change from spec §7.7: the `.expgrid` cards become one `select` plus a `Download` button that appears after a format is chosen. The container and its column position are unchanged.

- [ ] **Step 4: Run tests and the fidelity guard**

- [ ] **Step 5: Commit**

---

## Task 11: Deep links and print

**Files:**
- Modify: `src/app/state.ts`
- Create: `src/styles/print.css`, `src/app/deeplink.test.ts`

**Interfaces:**
- Produces: `encodeState(s: State, tab: Tab) -> URLSearchParams`, `decodeState(p: URLSearchParams) -> Partial<State> & { tab?: Tab }`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/deeplink.test.ts
test('round-trips every state field', …)
test('ignores an unknown parameter', …)
test('rejects an out-of-range year and falls back to the default', …)
test('rejects an unknown contour level', …)
test('a city name with diacritics survives the round trip', …)
test('replaces history rather than pushing on every slider tick', …)
```

The validation tests are the load-bearing ones: a deep link is untrusted input, and `?year=99999` or `?contour=L99` must not reach the map.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement URL sync and the print stylesheet**

Print: the rail, the header controls and the tab bar are hidden; the map stage and the active panel print at full width; `.brief` prints on one page. Per spec §8.5.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

---

## Task 12: Remaining correctness fixes, accessibility, deployment

**Files:**
- Modify: as each fix requires
- Create: `wrangler.toml` or the Cloudflare Pages build config, `README.md` deployment section
- Test: `tests/a11y.spec.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/a11y.spec.ts
test('prefers-reduced-motion disables the drawer and swipe transitions', …)   // spec §9.1 bug 8
test('every interactive control is reachable by keyboard', …)
test('tab changes are announced via aria-live', …)
test('no axe violations on any of the four tabs, in both themes', …)
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Apply the remaining §9.1 fixes**

Bug 9: already closed by plan 1 — `find . -type d -name data` returns only the repo-root `data/`, and `project/design_handoff_suhi_dashboard/` holds docs and CSS, no data. Verify this still holds, add a test that asserts exactly one `data/` directory, and mark the bug resolved in the spec rather than re-fixing it.
Bug 10: city circles must render above spots — docs say z-index 460, the original's code sets 410. Under MapLibre this becomes layer order; assert it.

- [ ] **Step 4: Configure Cloudflare Pages and document it**

Build command `npm run build`, output `dist`. Note in the README that `.pmtiles` needs a `Content-Type` and range-request support.

- [ ] **Step 5: Run the full suite, the audit, the fidelity guard and the build**

Run: `npm test && npm run audit && npm run ink && npm run fidelity && npm run build`
Expected: all green; fidelity reports zero diffs outside `ALLOWED_DIFFS`.

- [ ] **Step 6: Commit**

---

## Carried-forward decisions

Two items the user holds open, recorded so an implementer does not silently settle them:

- **Ruling 18 — multiplicity-weighted means.** `derive.mjs` weights a spot's `suhii`, `slope` and `hotdays` by the number of contour levels it carries (1, 2 or 3), reproducing the published figures. 30 of 55 cities change and the top-10 reorders if this is switched to L50-only. Flipping it is four `all`→`l50` edits in `scripts/lib/derive.mjs` plus three test updates. **Do not flip it without the user's instruction**; spec §2.1 documents it as a deliberate reproduction.
- **Gi\* z-score (spec §10.1).** When the supervisor supplies it, change the body of `encodeValue()` and the legend string, and recompute the domain bounds. Nothing else — not the ramp, the map style, the KPIs or the components.
- **The unscoped vendored base layer** (finding 1 below). Reproduced as-is because spec §3 says the original wins. If the user decides each theme should carry its own base typography, the fix is to wrap each vendored file's rules in its own `html[data-theme]` selector — one edit per file, in Task 2 Step 5, plus a fidelity-guard entry in `ALLOWED_DIFFS`. **Do not do this without the user's instruction.**

## Findings while planning

Three claims in the first draft of this plan were wrong against the repository. They are recorded because two of them change the work.

1. **The prototype is not self-contained.** Its inline `<style>` block is only part of its CSS; two unscoped vendored stylesheets load ahead of it and supply `body`, `h1`–`h6`, `a`, `p` and `:focus` rules, plus a full `:root` token set. Because neither is theme-scoped and Modernist loads second, **Modernist's base rules apply in both themes**. A rebuild that transcribed only the inline block would differ visibly in base type, link colour and focus treatment, and the fidelity guard would have reported it as a mass of small box and type diffs with no obvious cause. Now vendored explicitly (Global Constraints, Task 2 Step 5).

   This is worth the user's attention on its own: it means one of the two "independent design systems" is partly inert at the base layer in the shipping page. Reproducing it is the faithful choice under spec §3, but if the intent was that each theme get its own base typography, that is a real defect in the original and a one-line fix (scope each file to its `html[data-theme]`). **Not changed here — it needs the user's call**, and it is listed with the carried-forward decisions above.

2. **The fonts come from Google Fonts `@import`s inside those vendored files**, not from `<link>`s in the prototype's head. Replacing them with self-hosted fonts or a different weight set would change rendered metrics, so the import stays as-is.

3. **Spec §9.1 bug 9 is already fixed.** Plan 1 consolidated the data directories; only the repo-root `data/` exists. Task 12 verifies and closes it instead of deleting a duplicate that is not there.

## Self-review

**Spec coverage.** §3 fidelity rule → Task 3's guard plus every task's fidelity run. §4 tokens → Task 1. §4.3 deletions → Task 1 Step 9. §5 ink scale → Task 1, consumed in Tasks 4, 7, 8, 9. §5.6 accent fill → Tasks 1, 2. §6 encoding → Task 6. §7.1–7.4 → Tasks 2, 6, 7. §7.3 rail → Tasks 4, 5. §7.5–7.7 → Tasks 8, 9, 10. §7.8/§10.3 mobile → deliberately unimplemented, constrained in Global Constraints. §8.1 stack → Task 2. §8.3 basemap → Task 6. §8.4 deep links → Task 11. §8.5 print → Task 11. §8.6 deployment → Task 12. §9.1 bugs → 2 and 3 in Task 5; 4 and 6 in Task 7; 5 and 7 in Task 4; 8 in Tasks 7 and 12; 9 and 10 in Task 12; 1 is retracted. §9.2 guards → Tasks 1 and 3. §10 open items → recorded above, not implemented.

Two gaps found and closed while checking: spec §9.1 bug 3 (layer toggles with no keyboard access) had no owning task until it was pinned in Task 5's test list; and the vendored `_ds` base layer had no owner at all until finding 1 put it in Task 2 Step 5 — without which the fidelity guard in Task 3 would have failed diffusely from Task 4 onward with no single cause to chase.

**Type consistency.** `State` is defined once in Task 2 and consumed by name in Tasks 4, 5, 6, 10, 11. `Seg` is produced in Task 4 and reused in Tasks 5 and 8. `focusCity` is produced in Task 7 and consumed in Task 9. `paintEpoch` is produced in Task 2 and consumed only in Task 7. `deriveInk` and `INK_TOKENS` are produced in Task 1 and consumed by `scripts/ink.mjs` and the audit in the same task.

**Review Focus coverage.** All five are pinned: 1 and 2 in Task 6, 3 in Task 5, 4 in Task 7, 5 in Task 4.

**Proportion.** Twelve tasks over a spec of comparable length, with signatures and test names rather than function bodies. The only verbatim values are the 22 ink hexes (Task 1), which are the contract, and the 17 column names (Task 9), which are an order.
