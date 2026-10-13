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

