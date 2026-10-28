/* SPEC §9.1 BUG 9, verified and closed rather than re-fixed.
 *
 * The bug was `data/` duplicated in `project/` and in `design_handoff_suhi_dashboard/`:
 * "guaranteed drift", because derive.mjs writes one copy and the prototype fetches another.
 * Plan 1 consolidated them, so by the time this plan started there was nothing left to delete -
 * which is exactly why it needs a test rather than a tick. A bug fixed by deleting files
 * reopens the moment someone copies a folder "to try something", and nothing would notice until
 * two tabs showed different numbers.
 *
 * The rule this pins: ONE directory named `data` in the repository, at the root, and no data
 * file anywhere under `project/`. `project/` is the fidelity target (spec §3) and is read-only
 * by instruction; a `.json` of figures there would be a second source of truth for the published
 * values that `scripts/derive.mjs` owns.
 *
 * It walks the working tree rather than asking git, so an UNTRACKED copy - the likeliest way
 * this reopens - is caught too.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Directories that are nobody's business here: dependencies, build output, git internals. */
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report']);

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      visit(full, true);
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(join(dir, entry.name), false);
    }
  }
}

function tree() {
  const dirs = [];
  const files = [];
  walk(ROOT, (path, isDir) => (isDir ? dirs : files).push(relative(ROOT, path).split(sep).join('/')));
  return { dirs, files };
}

describe('spec §9.1 bug 9 — one data directory', () => {
  it('walked a real tree, so the assertions below are about something', () => {
    const { dirs, files } = tree();
    expect(dirs.length).toBeGreaterThan(10);
    expect(files).toContain('data/cities.json');
    expect(files).toContain('project/nigeria-suhi-dashboard.html');
  });

  it('has exactly one directory named data, and it is the repository root one', () => {
    const found = tree().dirs.filter((d) => d === 'data' || d.endsWith('/data'));
    expect(found).toEqual(['data']);
  });

  it('keeps no data file under project/, which is the fidelity target and read-only', () => {
    /* `_ds/` is excepted by name: the two vendored design systems ship `_ds_manifest.json` and
     * `_adherence.oxlintrc.json`, which are tooling manifests rather than figures. They are
     * named individually so that a third file appearing there has to be looked at. */
    const DATA_EXT = /\.(json|geojson|topojson|csv|tsv|ndjson)$/i;
    const ALLOWED = new Set([
      'project/_ds/modernist-d5e8375d-9e34-4bca-b8f9-2fafa7569ce0/_adherence.oxlintrc.json',
      'project/_ds/modernist-d5e8375d-9e34-4bca-b8f9-2fafa7569ce0/_ds_manifest.json',
    ]);
    const stray = tree()
      .files.filter((f) => f.startsWith('project/') && DATA_EXT.test(f))
      .filter((f) => !ALLOWED.has(f));
    expect(stray, 'scripts/derive.mjs owns the published figures; project/ may not hold a copy').toEqual([]);
  });

  it('serves the prototype from the repository root, which is why its ../data fetches resolve', () => {
    /* Ruling 22 the other way round: the prototype fetches `../data/*.json`, which escapes a
     * `project/` server root and 404s. That is only true while the data lives one level up from
     * the prototype, so the two facts are asserted together - move either and this fails. */
     const { files } = tree();
    expect(files).toContain('project/nigeria-suhi-dashboard.html');
    for (const name of ['spots.geojson', 'cities.json', 'clusters.json']) {
      expect(files, `project/nigeria-suhi-dashboard.html fetches ../data/${name}`).toContain(`data/${name}`);
    }
  });
});
