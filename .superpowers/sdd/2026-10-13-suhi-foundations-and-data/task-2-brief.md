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

