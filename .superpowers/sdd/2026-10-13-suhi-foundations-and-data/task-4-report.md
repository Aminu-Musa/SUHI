# Task 4 report

Built scripts/audit-contrast.mjs (auditPairs with overrides seam, formatTable, CLI exit 1 on any fail) and scripts/audit-contrast.test.mjs (3 tests). All values come from color/tokens/ramps modules; no hex literals. Red step: missing-module failure confirmed. Pinned ratios all matched the spec (no BLOCKED). Suite 25/25. Note: --surface-2 is the bg for text rows; fills against --bg.

## npm run audit output
```
pair                    fg       bg       ratio  floor  result
nocturne/--text         #eef1f5  #242931  12.90    4.5  PASS
nocturne/--text-muted   #9aa3b0  #242931   5.74    4.5  PASS
nocturne/--accent       #35c07d  #242931   6.26    4.5  PASS
nocturne/--hot-ink      #f2b64e  #242931   8.06    4.5  PASS
nocturne/--cold-ink     #98c9eb  #242931   8.28    4.5  PASS
nocturne/--on-accent    #0a0d11  #35c07d   8.33    4.5  PASS
nocturne/--hot-1        #8d3a32  #12151a   2.43    1.0  PASS
nocturne/--hot-2        #b45f37  #12151a   4.04    1.0  PASS
nocturne/--hot-3        #d6883e  #12151a   6.49    1.0  PASS
nocturne/--hot-4        #f2b64e  #12151a  10.09    1.0  PASS
nocturne/--hot-5        #ffe76c  #12151a  14.72    1.0  PASS
nocturne/--cold-1       #335698  #12151a   2.55    1.0  PASS
nocturne/--cold-2       #4f7cb4  #12151a   4.25    1.0  PASS
nocturne/--cold-3       #71a2cf  #12151a   6.77    1.0  PASS
nocturne/--cold-4       #98c9eb  #12151a  10.36    1.0  PASS
nocturne/--cold-5       #c4efff  #12151a  14.93    1.0  PASS
modernist/--text        #14171c  #e9ebed  15.03    4.5  PASS
modernist/--text-muted  #5b6472  #e9ebed   5.00    4.5  PASS
modernist/--accent      #0e7a4a  #e9ebed   4.50    4.5  PASS
modernist/--hot-ink     #ac4a11  #e9ebed   4.70    4.5  PASS
modernist/--cold-ink    #3563a4  #e9ebed   5.06    4.5  PASS
modernist/--on-accent   #ffffff  #0e7a4a   5.38    4.5  PASS
modernist/--hot-1       #ebd06b  #ffffff   1.53    1.0  PASS
modernist/--hot-2       #dba33f  #ffffff   2.25    1.0  PASS
modernist/--hot-3       #c6761e  #ffffff   3.49    1.0  PASS
modernist/--hot-4       #ac4a11  #ffffff   5.61    1.0  PASS
modernist/--hot-5       #8d1b17  #ffffff   9.12    1.0  PASS
modernist/--cold-1      #aad9f2  #ffffff   1.51    1.0  PASS
modernist/--cold-2      #7db2d8  #ffffff   2.27    1.0  PASS
modernist/--cold-3      #558bbe  #ffffff   3.61    1.0  PASS
modernist/--cold-4      #3563a4  #ffffff   6.05    1.0  PASS
modernist/--cold-5      #203a89  #ffffff  10.36    1.0  PASS

All pairs pass
```
