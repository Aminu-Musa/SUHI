# Task 2 review — controller-performed

The dispatched reviewer died on ENOTFOUND at its write step (the fifth network failure of
this task), so its analysis was lost. This review was performed by the controller, who also
finished the implementation — a weaker arrangement than an independent reviewer, and stated
here rather than glossed. Everything below is backed by a command that was run, not by
reading alone.

## A. Spec compliance — PASS, with one defect found and fixed

| Brief step | Verdict |
| --- | --- |
| 1 Scaffold + pinned deps | met, after ruling 18 resolved an ERESOLVE conflict |
| 2 Failing shell tests | met |
| 3 Verify they fail | met |
| 4 Implement shell | met, with two documented deviations (below) |
| 5 Transcribe CSS | **met, and provable** — see the diff result below |
| 6 Tests + build | met |
| 7 Extend CI | met: `npm test`, `npm run build`, `npm run audit` |
| 8 Commit | met |

### The CSS transcription is provably faithful

- `src/styles/vendor/nocturne.css` md5 `835dbae7b7b45d188d7f92a5412ea8bd` — identical to
  `project/_ds/nocturne-*/styles.css`.
- `src/styles/vendor/modernist.css` md5 `6f7808f971aa1cef3ef94a5754420030` — identical to
  `project/_ds/modernist-*/styles.css`.
- `src/styles/app.css` against prototype lines 63–241, comments and whitespace normalised,
  differs in **exactly three places**: `.kpi.hot/.cold .val` to the ink tokens,
  `.seg button[aria-pressed=true]` to `--accent-fill`, and the dropped `</style>`. The first
  two are spec §3's Changed table. Nothing else moved.

### Header fidelity

Element sequence and every fidelity-relevant attribute (`class`, `id`, `role`,
`aria-selected`, `aria-pressed`, `data-tab`, `data-i18n`, `title`) extracted from the rendered
DOM and compared against prototype lines 245–268: **identical ordering and values**.

## B. Code quality — PASS, after one fix

### FINDING 1 (was HIGH) — the ruling-7 effect double-fired under StrictMode. FIXED.

`src/main.tsx` wraps `#root` in `<StrictMode>`, but every test rendered a bare `<App />`.
StrictMode's deliberate double invocation therefore never ran in test, and the effect was
not idempotent. Proven empirically with a throwaway probe:

```
BOOT moves under StrictMode: ["dark","dark"]
AFTER theme change:          ["dark","dark","topo"]
```

So production called `setBase` **twice on every load** while the suite asserted `['dark']` and
passed. Harmless against Task 2's no-op stub; against Task 6's real `setBase` it is a double
tile-source swap on boot — a wasted fetch and a possible visible flash.

Secondary defect in the same code: `pickedRef.current = state.userPickedBase` was assigned
**during render** to keep the latch out of the dependency array. Writing a ref during render is
unsupported under concurrent rendering, where a discarded render still mutates it.

**Fix:** the guard became "have we already applied this key" (`lastApplied`) rather than "is the
latch set". That makes `state.userPickedBase` safe to list as a real dependency — the latch
flipping true re-runs the effect, which returns early, so the flip still never moves the
basemap, which is what ruling 7 requires. The effect is now idempotent, and **all three
component suites render inside `<StrictMode>`**, matching production.

Mutation evidence: removing the `lastApplied` guard fails
`theme drags the basemap (ruling 7) > changing theme moves the basemap while userPickedBase is
false` **alone**, 1 failed / 10 passed. Restored, md5 `1cb9083f864a35b4d3dd0c1b2aa62a20`.

### FINDING 2 (was LOW) — `data-framed` was scope creep. FIXED.

`.stage` carried a `data-framed` attribute the original does not have.
`grep -rn data-framed src/styles/ project/` confirmed **nothing styles it**, so it drove no
layout and existed only to be asserted. Its test was therefore asserting our invention rather
than the original's behaviour. Attribute removed; the test now asserts the `.framed` class,
which is what `.stage.framed` in app.css actually keys on and what prototype line 1009 toggles.

### FINDING 3 (LOW, accepted) — Radix injects ids the original lacks.

The tab buttons render `id="radix-_r_0_-trigger-map"` and so on. The original's tabs have no
`id`. Nothing styles them and they do not affect computed boxes, but they are generated and
unstable between runs, and they now serve nothing since `aria-controls` was deliberately
cleared. **Accepted, with a constraint carried to Task 3:** the fidelity guard compares
computed box and computed type per selector and must **not** compare `id` on `.tab`, or it will
fail on a value that changes every run. Recorded as ruling 21.

### FINDING 4 (LOW, accepted) — two different solutions to one problem.

`ThemeProvider` suppresses the boot-time write with `paintEpoch > 0`; `I18nProvider` uses a
separate `dirty` boolean, which costs an extra render on first change. Both are correct and
both are pinned by tests. Not worth the churn to unify mid-plan; noted so a later reader does
not assume one of them is a mistake.

### Verified clean

- **Scope:** `grep -rlE "maplibre|pmtiles|@tanstack|observablehq" src/` returns nothing — no
  later-task library is wired. Rail is an empty `<aside>`, panels are heading plus lede.
- **Untouched:** `git diff --name-only 173f7b2 HEAD -- project/ data/ scripts/ src/lib/ src/i18n/`
  is empty.
- **Storage (ruling 6):** `persist.ts` wraps the property access, not just the method call, in
  `readStored`, `readStoredEnum` and `writeStored`. Both halves pinned: a throwing read at boot
  (App.test) and a throwing write on change (ThemeProvider.test).
- **Ruling 5:** the mounted-but-hidden test asserts `window.getComputedStyle(el).display`, not
  presence. Mutation-proven earlier in the task.
- **Dependencies:** zero `^`/`~` ranges remain across 14 deps and 13 devDeps.
- **Final state:** 104 tests / 10 files green, `npm run audit` exit 0 at 80 pairs,
  `npm run build` emits 85.37 KB gzipped JS, `npm audit --omit=dev` reports 0.

## Carried to Task 3

1. The guard must not compare generated `id` attributes (ruling 21).
2. `ALLOWED_DIFFS` seeds from spec §3 **and** the five §9.1 pixel-changing fixes (ruling 15).
3. `PENDING` ships non-empty and must fail if a listed selector starts matching (ruling 2).
4. The suite is ~252 s cold and ~6 s warm; Playwright will add to the cold path.
