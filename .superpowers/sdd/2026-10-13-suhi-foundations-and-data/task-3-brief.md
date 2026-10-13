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

