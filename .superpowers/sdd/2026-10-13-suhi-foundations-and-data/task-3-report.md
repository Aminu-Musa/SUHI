# Task 3 report
Built: scripts/lib/tokens.mjs (THEME_TOKENS, SCALE_TOKENS, DENSITY), scripts/palette.mjs (renderRampsCss + CLI), scripts/palette.test.mjs, src/styles/suhi-tokens.css (hand-written), src/styles/_ramps.css (generated), ramp-direction tests in ramps.test.mjs.
Decisions: _ramps.css = ramps + --neutral-mid (per brief); other theme tokens live in suhi-tokens.css, with tests asserting CSS == tokens.mjs and _ramps.css == renderRampsCss(). Tracking tokens and line-heights (figure 1.1, title 1.2, section/label 1.3, body 1.6) are my additions; spec gave tracking but not all line-heights. Density blocks list scaled --space-* values literally; touch repeats --hit:44px.
TDD: first run failed on missing ./palette.mjs; direction tests passed immediately (guard on already-correct ramps). Final: 3 files, 21 tests pass.

## Fix round
F1: palette.test.mjs now asserts each theme block's key set equals THEME_TOKENS[t] minus --neutral-mid, :root keys equal SCALE_TOKENS exactly, and each selector appears once. Verified by mutation: stray `--hot-3` in nocturne block -> 1 failure; second `:root{--x}` -> 2 failures; both reverted.
F2: palette.mjs guard is now `import.meta.url === pathToFileURL(process.argv[1]).href`. Verified: overwrote _ramps.css with "junk", ran `npm run palette` -> "wrote ...\_ramps.css", `git status` clean (file regenerated identically).
Tests: palette.test.mjs + ramps.test.mjs 18 pass; full suite run after.
