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

