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

