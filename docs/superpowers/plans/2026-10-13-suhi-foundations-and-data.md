# SUHI Foundations & Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design-system token layer and the data pipeline the application rebuild consumes, with the contrast audit and the aggregation rules enforced as tests.

**Architecture:** Two generators write artifacts the app only ever reads. `scripts/palette.mjs` emits the data ramps as CSS custom properties from OKLCH parameters; `scripts/derive.mjs` regenerates `cities.json`, `clusters.json` and `spots.topo.json` from `spots.geojson`. Three guards run in CI: a contrast audit, a byte-for-byte derive check, and a diacritic fixture. No application code here — this plan ends with verified artifacts and a green `npm test`.

**Tech Stack:** Node 22, npm 10, Vitest, topojson-server/topojson-simplify. No runtime dependencies; everything here is build-time.

**Spec:** `docs/superpowers/specs/2026-10-13-suhi-dashboard-design-system-design.md` (commit `5bc4d1d`)

**Scope note.** The spec covers more than one plan's worth. This is plan 1 of 2. Plan 2 (`suhi-app-rebuild`) covers the Vite/MapLibre application, the four views, print and deployment, and consumes every artifact produced here. Eight of the ten defects in spec §9.1 live in the prototype being replaced and are **not** fixed here — fixing code we are deleting is waste. They become acceptance criteria on plan 2's tasks instead. The two that are data- or repo-level — §9.1 item 1 (mojibake typologies) and item 9 (duplicated `data/`) — are fixed here, in Tasks 5 and 8.

**Test fixture convention.** Every test that needs the source data reads it once at module scope as `const fc = JSON.parse(await readFile('data/spots.geojson', 'utf8'))`. Before Task 8 that path is `project/data/spots.geojson`.

## Global Constraints

- Node 22+, ESM only (`"type": "module"`). No CommonJS.
- All generated files are UTF-8 without BOM, LF line endings.
- No runtime dependencies added. Everything in this plan is `devDependencies`.
- Contrast floor: **4.5:1** for text, **3:1** for large text (≥24px or ≥18.5px bold). No exceptions.
- Counts, areas and populations aggregate **`contour_level === 'L50'` only**. Means (`suhii`, `mean_lst`, `slope`, `hotdays`) are taken over **all** levels; `max_lst` is a max over all levels.
- Typology separator is `' · '` (U+00B7, spaces either side). Ranges use an en-dash (U+2013), never a hyphen.
- Derived encoding field is named **`lst_rel`**. Never `gi_z`, never anything implying it is the Gi\* statistic.
- Commit after every task.

## Review Focus

Five conditions the spec implies but does not give a task. Each has its test pinned to the owning task below.

1. **A spot with `mean_lst: null`** (2 exist) must not poison its city's reference mean or produce `NaN` from `encodeValue`. → Task 6.
2. **A city/period with no L50 hot spots** has no reference mean; `encodeValue` must not divide by zero or return `undefined`. → Task 6.
3. **A ramp parameter change that breaks step separation** (two steps within 0.07 OKLCH lightness) must fail the build, not ship a ramp nobody can read. → Task 2.
4. **A dictionary string whose diacritics are stripped** (e.g. `Ọnụọgụ` → `Onuogu`) must fail the fixture — a silent downgrade is the exact failure mode native review is meant to catch. → Task 7.
5. **A `clusters.json` written through a non-UTF-8 path** must fail the derive check, since that is precisely how the current mojibake arose. → Task 5.

---

### Task 1: Colour maths module

**Files:**
- Create: `package.json`, `scripts/lib/color.mjs`
- Test: `scripts/lib/color.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `hexToOklch(hex: string) -> {L: number, C: number, H: number}` (H in radians), `oklchToHex(L: number, C: number, H: number) -> string` (lowercase `#rrggbb`, channels clamped to gamut), `relativeLuminance(hex: string) -> number`, `contrastRatio(a: string, b: string) -> number`.

- [ ] **Step 1: Scaffold the package**

`package.json` with `"type": "module"`, `"private": true`, devDependency `vitest`, and scripts: `"test": "vitest run"`, `"palette": "node scripts/palette.mjs"`, `"derive": "node scripts/derive.mjs"`, `"audit": "node scripts/audit-contrast.mjs"`.

Run `npm install`.

- [ ] **Step 2: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { hexToOklch, oklchToHex, contrastRatio, relativeLuminance } from './color.mjs';

it('round-trips a hex through OKLCH', () => {
  const { L, C, H } = hexToOklch('#35c07d');
  expect(oklchToHex(L, C, H)).toBe('#35c07d');
});

it('computes known relative luminances', () => {
  expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
});

it('computes known contrast ratios', () => {
  expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  expect(contrastRatio('#eef1f5', '#242931')).toBeCloseTo(12.90, 1);
  expect(contrastRatio('#14171c', '#e9ebed')).toBeCloseTo(15.03, 1);
});

it('clamps out-of-gamut OKLCH to a valid hex', () => {
  expect(oklchToHex(0.95, 0.4, 0)).toMatch(/^#[0-9a-f]{6}$/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./color.mjs`.

- [ ] **Step 4: Implement the four functions in `scripts/lib/color.mjs`**

Standard sRGB ↔ linear ↔ LMS ↔ OKLab matrices; WCAG 2.1 relative luminance and the `(L1+0.05)/(L2+0.05)` ratio. Gamut clamp is per-channel on linear RGB before encoding.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/lib/color.mjs scripts/lib/color.test.mjs
git commit -m "feat: add OKLCH and WCAG contrast maths"
```

---

### Task 2: Ramp generator

**Files:**
- Create: `scripts/lib/ramps.mjs`
- Test: `scripts/lib/ramps.test.mjs`

**Interfaces:**
- Consumes: `oklchToHex`, `hexToOklch` from Task 1.
- Produces: `buildRamp({L0, L1, C0, C1, H0, H1, steps = 5}) -> string[]`, and `RAMPS` — a frozen object keyed `nocturne` / `modernist`, each `{hot, cold}` holding the parameter object for that ramp.

**Ramp parameters (spec §5.2).** Hue in degrees. Nocturne climbs in lightness (black-body); Modernist descends (ink on paper).

| Theme | Ramp | L0 → L1 | C0 → C1 | H0 → H1 |
| --- | --- | --- | --- | --- |
| nocturne | hot | 0.46 → 0.93 | 0.115 → 0.145 | 28 → 95 |
| nocturne | cold | 0.46 → 0.93 | 0.115 → 0.055 | 262 → 232 |
| modernist | hot | 0.86 → 0.42 | 0.125 → 0.150 | 95 → 28 |
| modernist | cold | 0.86 → 0.38 | 0.060 → 0.135 | 232 → 266 |

- [ ] **Step 1: Write the failing tests**

```js
import { buildRamp, RAMPS } from './ramps.mjs';
import { hexToOklch } from './color.mjs';

it('reproduces the spec ramp literals', () => {
  expect(buildRamp(RAMPS.nocturne.hot)).toEqual(
    ['#8d3a32', '#b45f37', '#d6883e', '#f2b64e', '#ffe76c']);
  expect(buildRamp(RAMPS.nocturne.cold)).toEqual(
    ['#335698', '#4f7cb4', '#71a2cf', '#98c9eb', '#c4efff']);
  expect(buildRamp(RAMPS.modernist.hot)).toEqual(
    ['#ebd06b', '#dba33f', '#c6761e', '#ac4a11', '#8d1b17']);
  expect(buildRamp(RAMPS.modernist.cold)).toEqual(
    ['#aad9f2', '#7db2d8', '#558bbe', '#3563a4', '#203a89']);
});

// Review Focus 3 — a ramp whose steps are confusable must fail the build
it.each(['nocturne', 'modernist'])('keeps every %s step >= 0.07 apart in lightness', (theme) => {
  for (const family of ['hot', 'cold']) {
    const ls = buildRamp(RAMPS[theme][family]).map(h => hexToOklch(h).L);
    for (let i = 1; i < ls.length; i++) {
      expect(Math.abs(ls[i] - ls[i - 1])).toBeGreaterThanOrEqual(0.07);
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./ramps.mjs`.

- [ ] **Step 3: Implement `buildRamp` and `RAMPS` in `scripts/lib/ramps.mjs`**

Linear interpolation of L, C and H across `steps`, converting each with `oklchToHex`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. If the literals do not match, the parameters in the table are authoritative — report the mismatch rather than editing the expected values.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ramps.mjs scripts/lib/ramps.test.mjs
git commit -m "feat: generate data ramps from OKLCH parameters"
```

---

### Task 3: Token stylesheet and palette emitter

**Files:**
- Create: `scripts/palette.mjs`, `src/styles/suhi-tokens.css`, `src/styles/_ramps.css` (generated)
- Test: `scripts/palette.test.mjs`

**Interfaces:**
- Consumes: `buildRamp`, `RAMPS` from Task 2.
- Produces: `src/styles/_ramps.css` — two `html[data-theme="…"]` blocks declaring `--hot-1…5`, `--cold-1…5`, `--neutral-mid`. `suhi-tokens.css` `@import`s it.

**Hand-written tokens for `suhi-tokens.css`** (spec §4.2, §4.3, §5.1, §5.3). Generated ramps are the only machine-written part.

```
:root  --space-1:4px --space-2:8px --space-3:12px --space-4:16px
       --space-6:24px --space-8:32px --space-12:48px
       --radius-sm:0px --radius-md:2px --radius-lg:4px
       --rule:1px --rule-strong:2px --hit:44px
[data-density="compact"] 0.85×   [data-density="touch"] 1.15×   (default 1×)
```

| Token | nocturne | modernist |
| --- | --- | --- |
| `--bg` | `#12151a` | `#ffffff` |
| `--surface` | `#1a1e25` | `#f4f5f6` |
| `--surface-2` | `#242931` | `#e9ebed` |
| `--rule-color` | `#2e343d` | `#d5d9dd` |
| `--rule-strong-color` | `#434a55` | `#1a1d22` |
| `--text` | `#eef1f5` | `#14171c` |
| `--text-muted` | `#9aa3b0` | `#5b6472` |
| `--accent` | `#35c07d` | `#0e7a4a` |
| `--on-accent` | `#0a0d11` | `#ffffff` |
| `--hot-ink` | `#f2b64e` | `#ac4a11` |
| `--cold-ink` | `#98c9eb` | `#3563a4` |
| `--neutral-mid` | `#39404b` | `#d9dcdf` |
| `--track` | `#b6bdc9` | `#c2c8cf` |

Also `--bar-cap: 2px` (spec §5.4) — the end cap on every bar fill, drawn in `--text`.
It is mandatory: no track colour contrasts with a full-range ramp, so without it a bar
whose tip lands near the track colour has an invisible end.

Type scale as `--font-display: 800 34px/1.1`, `--font-figure`, `--font-title`, `--font-section`, `--font-body`, `--font-label` per spec §4.1. `--font-family: Archivo, system-ui, sans-serif`.

- [ ] **Step 1: Write the failing test**

```js
it('emits both theme blocks with all eleven ramp tokens', () => {
  const css = renderRampsCss();
  expect(css).toContain('html[data-theme="nocturne"]');
  expect(css).toContain('--hot-5: #ffe76c;');
  expect(css).toContain('--cold-1: #335698;');
  expect(css).toContain('--neutral-mid: #39404b;');
  expect(css).toContain('html[data-theme="modernist"]');
  expect(css).toContain('--hot-5: #8d1b17;');
  expect(css).toContain('--neutral-mid: #d9dcdf;');
});

it('declares no token twice within a theme block', () => {
  for (const block of renderRampsCss().split('html[data-theme=').slice(1)) {
    const names = [...block.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
    expect(new Set(names).size).toBe(names.length);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `renderRampsCss` not exported.

- [ ] **Step 3: Implement `renderRampsCss() -> string` in `scripts/palette.mjs`, and write `src/styles/suhi-tokens.css` by hand**

`palette.mjs` run as a CLI writes `src/styles/_ramps.css`. `suhi-tokens.css` carries the tables above plus `@import "./_ramps.css";` and a header comment naming `npm run palette` as the generator.

- [ ] **Step 4: Generate and verify**

Run: `npm run palette && npm test`
Expected: PASS; `src/styles/_ramps.css` exists with two theme blocks.

- [ ] **Step 5: Commit**

```bash
git add scripts/palette.mjs scripts/palette.test.mjs src/styles/
git commit -m "feat: add design token stylesheet and ramp emitter"
```

---

### Task 4: Contrast audit guard

**Files:**
- Create: `scripts/audit-contrast.mjs`
- Test: `scripts/audit-contrast.test.mjs`

**Interfaces:**
- Consumes: `contrastRatio` from Task 1; the token tables from Task 3.
- Produces: `auditPairs() -> {use: string, fg: string, bg: string, ratio: number, floor: number, pass: boolean}[]`. The CLI prints a table and exits `1` if any `pass === false`.

**Pairs to audit**, each against `--surface-2` of its theme: `--text`, `--text-muted`, `--accent`, `--hot-ink`, `--cold-ink` at floor 4.5; `--on-accent` against `--accent` at floor 4.5; every `--hot-*` and `--cold-*` **fill** against `--bg` at floor **1.0** (fills are geometry, not text — recorded for visibility, never failed on).

- [ ] **Step 1: Write the failing test**

```js
it('passes every text pair at its floor', () => {
  const failures = auditPairs().filter(p => !p.pass);
  expect(failures).toEqual([]);
});

it('pins the ratios the spec publishes', () => {
  const byUse = Object.fromEntries(auditPairs().map(p => [p.use, p.ratio]));
  expect(byUse['nocturne/--cold-ink']).toBeCloseTo(8.28, 1);
  expect(byUse['nocturne/--hot-ink']).toBeCloseTo(8.06, 1);
  expect(byUse['modernist/--hot-ink']).toBeCloseTo(4.70, 1);
  expect(byUse['modernist/--accent']).toBeCloseTo(4.50, 1);
  expect(byUse['nocturne/--on-accent']).toBeCloseTo(8.33, 1);
});

it('exits non-zero when a pair regresses', () => {
  expect(auditPairs({ overrides: { 'nocturne/--cold-ink': '#3467ad' } })
    .find(p => p.use === 'nocturne/--cold-ink').pass).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `auditPairs` not defined.

- [ ] **Step 3: Implement `auditPairs` and the CLI in `scripts/audit-contrast.mjs`**

`overrides` is a test seam mapping a pair key to a replacement foreground.

- [ ] **Step 4: Run the audit and the tests**

Run: `npm run audit && npm test`
Expected: audit exits 0 and prints every pair; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-contrast.mjs scripts/audit-contrast.test.mjs
git commit -m "feat: fail the build on any contrast regression"
```

---

### Task 5: Derive cities and clusters

**Files:**
- Create: `scripts/lib/derive.mjs`, `scripts/derive.mjs`
- Test: `scripts/lib/derive.test.mjs`
- Modify: `data/clusters.json` (regenerated — fixes §9.1 item 1)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `deriveCities(fc) -> City[]`, `deriveClusters(fc) -> Cluster[]`, `typologyString(landcover: string, elevationClass: string, geologyClass: string) -> string`, and `serialize(value) -> string` — the single writer used by both the CLI and the byte-for-byte test, `JSON.stringify(value, null, 1)` plus a trailing newline.

**Aggregation rules (spec §2, §9.2).** L50 only for `hot`, `cold`, `area_hot`, `area_cold`, `pop_hot`, `pop_cold`, `sig`, `persist`. Means over all levels for `suhii`, `mean_lst`, `slope`, `hotdays`; `max_lst` is a max over all levels. Centroid is the unweighted mean of every coordinate of every feature for that city. `pct_hot` = L50 hot area ÷ `city_area_km2` × 100; same for `pct_cold`. Dominant class fields are the modal value by feature count, ties broken by first occurrence.

**Abbreviation maps for `typologyString`.** Source vocabularies are clean UTF-8; building the string fresh is what prevents the mojibake, so there is no repair step.

| `elevation_class` | → | | `geology_class` | → |
| --- | --- | --- | --- | --- |
| `Very Low (0-100m)` | `0–100 m` | | `Metamorphic formation` | `Metamorphic` |
| `Low (101-500m)` | `101–500 m` | | `Sedimentary formation` | `Sedimentary` |
| `Moderate (501-1000m)` | `501–1000 m` | | `Sedimentary & basement formation` | `Sedimentary & basement` |
| `High (1001-1500m)` | `1001–1500 m` | | `Undifferentiated basement complex` | `Basement complex` |

Result: `` `${landcover} · ${elev} · ${geol}` ``.

- [ ] **Step 1: Write the failing tests**

```js
const fc = JSON.parse(await readFile('data/spots.geojson', 'utf8'));

it('builds typology strings in clean UTF-8', () => {
  expect(typologyString('Grassland', 'Low (101-500m)', 'Metamorphic formation'))
    .toBe('Grassland · 101–500 m · Metamorphic');
});

// Review Focus 5 — mojibake must fail, not ship
it('emits no mis-encoded typology', () => {
  for (const c of deriveClusters(fc)) {
    expect(c.typology).not.toMatch(/Â|â€|Ã/);
  }
});

it('derives 55 cities and 16 occupied clusters', () => {
  expect(deriveCities(fc)).toHaveLength(55);
  expect(deriveClusters(fc)).toHaveLength(16);
});

it('aggregates counts and population from L50 only', () => {
  const ibadan = deriveCities(fc).find(c => c.city === 'Ibadan');
  expect(ibadan.hot).toBe(2);
  expect(ibadan.cold).toBe(2);
  expect(ibadan.pop_hot).toBe(15378);
  expect(Math.round(deriveCities(fc).reduce((s, c) => s + c.pop_hot, 0))).toBe(137472);
});

it('takes max_lst over all contour levels', () => {
  expect(deriveCities(fc).find(c => c.city === 'Ibadan').max_lst).toBeCloseTo(43.296, 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found. The mojibake test will also fail against the committed `clusters.json` until step 4 regenerates it.

- [ ] **Step 3: Implement the three functions in `scripts/lib/derive.mjs`, and the CLI in `scripts/derive.mjs`**

The CLI reads `data/spots.geojson` and writes `data/cities.json` and `data/clusters.json` with `JSON.stringify(value, null, 1)` and a trailing newline, UTF-8, LF.

- [ ] **Step 4: Regenerate and diff**

Run: `npm run derive && git diff --stat data/`
Expected: `cities.json` unchanged or whitespace-only; `clusters.json` changes **only** in the 16 `typology` strings, each losing its `Â`/`â€“` sequences. Inspect the diff before continuing — any other change is a bug in the aggregation, not a fix.

- [ ] **Step 5: Add the byte-for-byte guard**

```js
it('reproduces the committed JSON byte for byte', async () => {
  expect(serialize(deriveCities(fc))).toBe(await readFile('data/cities.json', 'utf8'));
  expect(serialize(deriveClusters(fc))).toBe(await readFile('data/clusters.json', 'utf8'));
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/derive.mjs scripts/lib/derive.test.mjs scripts/derive.mjs data/clusters.json data/cities.json
git commit -m "feat: derive cities and clusters, fixing mojibake typologies"
```

---

### Task 6: The encoding variable

**Files:**
- Create: `src/lib/encode.mjs`
- Test: `src/lib/encode.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildReferenceMeans(features) -> Map<string, number>` keyed `` `${city}|${period}` ``, over **L50 features with a non-null `mean_lst` only**; `encodeValue(props, refs) -> number | null`, returning `mean_lst − refs.get(key)`, and `null` when `mean_lst` is null or no reference exists; `ENCODE_DOMAIN = [-4.5, 4.5]`; `ENCODE_FIELD = 'lst_rel'`.

This is the single function that owns what colour means (spec §6.1). When Gi\* z-scores arrive, only `encodeValue`'s body and the legend string change.

- [ ] **Step 1: Write the failing tests**

```js
it('computes lst_rel against the city/period L50 mean', () => {
  const refs = buildReferenceMeans(fc.features);
  const p = fc.features.find(f => f.properties.spot_id === 'aba_dc_T2_001').properties;
  expect(encodeValue(p, refs)).toBeCloseTo(p.mean_lst - refs.get('Aba|day'), 6);
});

it('agrees in sign with spot_type for at least 85% of spots', () => {
  const refs = buildReferenceMeans(fc.features);
  const scored = fc.features.map(f => [f.properties, encodeValue(f.properties, refs)])
    .filter(([, v]) => v !== null);
  const ok = scored.filter(([p, v]) =>
    (p.spot_type === 'hot' && v > 0) || (p.spot_type === 'cold' && v < 0)).length;
  expect(ok / scored.length).toBeGreaterThan(0.85);   // measured: 86.3%
});

// Review Focus 1 — the two null mean_lst spots
it('returns null for a spot with no mean_lst, and never NaN', () => {
  const refs = buildReferenceMeans(fc.features);
  expect(encodeValue({ city: 'Aba', period: 'day', mean_lst: null }, refs)).toBeNull();
  for (const f of fc.features) expect(encodeValue(f.properties, refs)).not.toBeNaN();
});

// Review Focus 2 — a city/period with no L50 reference
it('returns null when the city/period has no reference mean', () => {
  const refs = buildReferenceMeans(fc.features);
  expect(encodeValue({ city: 'Nowhere', period: 'night', mean_lst: 30 }, refs)).toBeNull();
});

it('excludes null mean_lst from the reference mean', () => {
  const refs = buildReferenceMeans([
    { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: 30 } },
    { properties: { city: 'X', period: 'day', contour_level: 'L50', mean_lst: null } },
  ]);
  expect(refs.get('X|day')).toBe(30);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `encode.mjs`.

- [ ] **Step 3: Implement the module in `src/lib/encode.mjs`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/encode.mjs src/lib/encode.test.mjs
git commit -m "feat: add lst_rel encoding variable with null handling"
```

---

### Task 7: Diacritic fixture

**Files:**
- Create: `src/i18n/dictionary.mjs`, `src/i18n/dictionary.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `D` — the dictionary object keyed by string id, each value a four-element array in `['en','ha','ig','yo']` order; `LANGS = ['en','ha','ig','yo']`; `T(key, lang) -> string`.

Port the dictionary from `project/nigeria-suhi-dashboard.html` verbatim — same keys, same strings. Add `headline` (spec §7.1) as a template with `{n}` and `{scope}` placeholders.

- [ ] **Step 1: Write the failing tests**

```js
it('gives every key four entries', () => {
  for (const [k, v] of Object.entries(D)) {
    expect(v, k).toHaveLength(4);
    for (const s of v) expect(typeof s, k).toBe('string');
  }
});

// Review Focus 4 — a stripped diacritic is a silent downgrade
it('preserves Igbo dot-below and Yoruba tone marks', () => {
  expect(D.pop_in_hot[2]).toContain('Ọnụọgụ');
  expect(D.pop_in_hot[3]).toContain('ènìyàn');
});

it('keeps every non-English string in NFC and free of mojibake', () => {
  for (const [k, v] of Object.entries(D)) {
    for (const s of v.slice(1)) {
      expect(s.normalize('NFC'), k).toBe(s);
      expect(s, k).not.toMatch(/Â|â€|Ã/);
    }
  }
});

it('leaves scientific vocabulary untranslated', () => {
  for (const term of ['SUHI', 'LST', 'MODIS', 'Gi*', 'Benjamini']) {
    for (const v of Object.values(D)) {
      if (v[0].includes(term)) for (const s of v) expect(s).toContain(term);
    }
  }
});

it('renders the headline template in all four languages', () => {
  for (const lang of LANGS) {
    expect(T('headline', lang).replace('{n}', '137,470')).toContain('137,470');
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Port the dictionary into `src/i18n/dictionary.mjs` and add the `headline` key**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. A failure on the NFC or scientific-vocabulary test means the port altered a string — fix the port, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat: port dictionary with diacritic and encoding fixtures"
```

---

### Task 8: TopoJSON and data consolidation

**Files:**
- Create: `data/spots.topo.json` (generated)
- Modify: `scripts/derive.mjs` (add topo emit), `project/nigeria-suhi-dashboard.html:593-595` (data paths)
- Delete: `project/design_handoff_suhi_dashboard/data/`, `project/data/`
- Test: `scripts/lib/derive.test.mjs` (extend)

**Interfaces:**
- Consumes: `deriveCities`, `deriveClusters` from Task 5.
- Produces: `data/` at the repository root as the single source for all three files, plus `spots.topo.json`.

Resolves §9.1 item 9. The two existing copies are byte-identical, verified with `cmp`.

- [ ] **Step 1: Write the failing tests**

```js
it('round-trips every feature through TopoJSON', async () => {
  const topo = JSON.parse(await readFile('data/spots.topo.json', 'utf8'));
  const back = feature(topo, topo.objects.spots);
  expect(back.features).toHaveLength(441);
  const ids = new Set(back.features.map(f => f.properties.spot_id));
  for (const f of fc.features) expect(ids.has(f.properties.spot_id)).toBe(true);
});

it('keeps the payload under 400 KB', async () => {
  expect((await stat('data/spots.topo.json')).size).toBeLessThan(400 * 1024);
});

it('retains all 30 attributes per feature', async () => {
  const topo = JSON.parse(await readFile('data/spots.topo.json', 'utf8'));
  const p = feature(topo, topo.objects.spots).features[0].properties;
  expect(Object.keys(p).length).toBeGreaterThanOrEqual(30);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `data/spots.topo.json` does not exist.

- [ ] **Step 3: Move the data and add the topo emit**

```bash
git mv project/data data
git rm -r project/design_handoff_suhi_dashboard/data
```

Add `topojson-server`, `topojson-simplify` and `topojson-client` (the last for `feature()` in the round-trip test) as devDependencies. In `scripts/derive.mjs`, quantize and simplify to the largest tolerance that still passes the round-trip test, writing `data/spots.topo.json` with the object named `spots`.

- [ ] **Step 4: Point the prototype at the new paths**

In `project/nigeria-suhi-dashboard.html`, change the three `d3.json('data/…')` calls to `'../data/…'`.

- [ ] **Step 5: Run tests and load the prototype**

Run: `npm run derive && npm test`
Expected: PASS.
Then serve and confirm the prototype still renders 441 polygons with no console errors — it is the reference implementation until plan 2 replaces it.

- [ ] **Step 6: Commit**

```bash
git add -A data scripts project/nigeria-suhi-dashboard.html package.json package-lock.json
git commit -m "feat: emit TopoJSON and consolidate data to a single directory"
```

---

## Done when

- `npm test` passes: 8 modules, all green.
- `npm run audit` exits 0 and prints every token pair at or above its floor.
- `npm run derive` reproduces `data/cities.json` and `data/clusters.json` byte for byte, and no typology contains a mis-encoded sequence.
- `data/spots.topo.json` is under 400 KB and round-trips all 441 features with 30 attributes each.
- One `data/` directory at the repository root.
- The existing prototype still loads and renders from the new paths.

## Not in this plan

- Any application code. Plan 2 (`suhi-app-rebuild`) covers Vite, MapLibre, PMTiles, the four views, print and deployment.
- Spec §9.1 items 2, 3, 4, 5, 7, 8, 10 — defects in the prototype being replaced. They become acceptance criteria on plan 2's tasks rather than edits to code we are deleting.
- Spec §10.1 (Gi\* z-score) and §10.2 (city population, admin boundaries, native language review) — blocked on inputs from outside the repository.
