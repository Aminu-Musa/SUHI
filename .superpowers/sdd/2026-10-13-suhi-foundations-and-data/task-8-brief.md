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
