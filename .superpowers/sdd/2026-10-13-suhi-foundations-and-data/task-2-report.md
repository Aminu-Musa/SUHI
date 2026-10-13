# Task 2 report: ramp generator

Status: DONE

- Step 0: `.gitattributes` (`* text=auto eol=lf`) + `git add --renormalize .`, committed separately: 3ff7b93 "chore: pin LF line endings".
- Built `scripts/lib/ramps.mjs` (`buildRamp`, frozen `RAMPS`) and `scripts/lib/ramps.test.mjs` (brief's tests verbatim).
- `buildRamp` takes hue in degrees and converts to radians internally before `oklchToHex`. Linear interpolation of L, C, H; steps=1 guarded (t=0). RAMPS is deep-frozen.
- TDD: first run failed with "Failed to load url ./ramps.mjs" (correct reason). After implementing: all literals matched exactly on the first run, no mismatch; DeltaL >= 0.07 passed for all four ramps on the brief's own parameters.

Test output: Test Files 2 passed (2), Tests 7 passed (7) (color 4, ramps 3).
