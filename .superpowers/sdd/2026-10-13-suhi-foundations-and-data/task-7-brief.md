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

