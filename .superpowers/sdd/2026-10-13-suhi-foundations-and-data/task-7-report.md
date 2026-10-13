# Task 7 report
Ported const D (source lines 413-543) byte-verbatim via sed (source read as UTF-8, no CR, no BOM) into src/i18n/dictionary.mjs; 97 keys total = source keys + headline + headline_scoped.
Added: LANGS, T(key, lang='en') (unknown key -> key; unknown lang/empty -> English), headline and headline_scoped (first-pass ha/ig/yo, marked in comment).
Only deviation from source: a trailing comma appended after the last source entry (vs_rural) to allow the added keys. No string differed.
Extra test: parses the source HTML and toEquals the ported D (minus headline keys), keys and order -> proves verbatim port permanently.
TDD: initial run failed with "Failed to load url ./dictionary.mjs" (63 pass, 1 file fail); after impl 73/73 pass.
Uncertainties: headline translations are my first pass, need native review. NFC test: 'ọ́' has no precomposed single code point in all cases; the test asserts NFC is a fixed point.

## Review fix (6187839)
Vocabulary test now asserts hits>0 per term; terms: SUHI, LST, Benjamini, Hochberg, Sen. MODIS and Gi* removed with a comment (they reach the UI via markup/concatenation, not dictionary values). Removed the redundant aggregate "not vacuous" test. Renamed the NFC single-string test to 'contains real combining marks, so the NFC test is exercising something'.
Commands: npx vitest run src/i18n/dictionary.test.mjs -> 9/9 pass; npm test -> 72/72 pass (7 files). Test count fell by one because the aggregate test was folded in.
