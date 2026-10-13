# Task 6 report
Built src/lib/encode.mjs (buildReferenceMeans, encodeValue, ENCODE_DOMAIN, ENCODE_FIELD) and src/lib/encode.test.mjs (8 tests: the brief's 5 plus L50-only/period-separation, name-pins-proxy, symmetric domain).
TDD: tests failed first (cannot load ./encode.mjs), then passed.
Measured sign agreement: 379/439 = 86.33% (2 null mean_lst excluded).
Suite: 63/63 passing (6 files). Data read from data/spots.geojson only.
Proxy-not-statistic documented in module header and pinned by a test named for the reason.
Concerns: none. Brief said "5 tests"; I added 3 extra.
