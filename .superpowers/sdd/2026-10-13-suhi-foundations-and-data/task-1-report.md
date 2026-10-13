# Task 1 report: colour maths

Status: DONE

Built: package.json (ESM, private, devDep vitest ^3.2.4 -> 3.2.7 installed, scripts test/palette/derive/audit; no stubs),
scripts/lib/color.mjs (hexToOklch [H radians, 0..2pi], oklchToHex [lowercase, per-channel linear clamp, NaN -> 0],
relativeLuminance, contrastRatio), scripts/lib/color.test.mjs (4 tests verbatim).

TDD: first run failed with "Failed to load url ./color.mjs". After implementation: 4/4 passed.
Decisions: Ottosson OKLab matrices; parseHex throws on malformed hex, accepts optional '#'.
Concerns: npm install reported audit vulnerabilities (dev-only, not addressed). Report dir is gitignored (.superpowers/).
