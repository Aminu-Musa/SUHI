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

