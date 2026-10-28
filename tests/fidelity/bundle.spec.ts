/* TASK 12, carried item 8: bundle weight, as a BUDGET rather than a note.
 *
 * The item said "measure on a throttled profile; report before optimising", and the measuring
 * was done — the numbers are in the README's Weight section and in the ledger. This file is
 * what keeps them true. It asserts sizes, never times: a timing assertion in CI is flaky, and
 * "a flaky fidelity guard is worse than none" (playwright.config.ts) applies to every guard in
 * this repository. Bytes after gzip are deterministic for a given build.
 *
 * It lives beside the fidelity guard because `globalSetup` builds `dist/` before anything runs,
 * so these assertions are always about a fresh build rather than whatever was last left there.
 *
 * WHAT IT IS REALLY GUARDING is the split, not the kilobytes. `MapStage` sits behind a dynamic
 * import so a reader opening the Data table from a §8.4 deep link does not download MapLibre
 * and its tile worker to never put a pixel on screen — measured at 434.5 kB against 2,042.9 kB
 * on the wire. A static import added anywhere in the app's entry graph would silently undo
 * that, and the first assertion below is what fails when it does.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = resolve(import.meta.dirname, '..', '..', 'dist');
const ASSETS = resolve(DIST, 'assets');

const gzKb = (file: string) => gzipSync(readFileSync(file)).length / 1024;
const rawKb = (file: string) => readFileSync(file).length / 1024;
const find = (pattern: RegExp) => readdirSync(ASSETS).filter((f) => pattern.test(f));

/* Budgets in kB GZIPPED, roughly 20% above what the build produces today. Loose enough that a
 * dependency patch does not fail the build, tight enough that another MapLibre-sized import
 * cannot arrive unnoticed. Raise one deliberately, in a commit that says why — that is the
 * entire point of writing them down. */
const BUDGET = {
  /** Everything a reader downloads before any tab-specific work: html + entry js + entry css. */
  initial: 175,
  /** The map chunk, requested only once the Map tab is wanted. */
  mapChunk: 350,
  /** MapLibre's tile worker, raw: Vite emits it unhashed-by-content-type and reports no gzip. */
  workerRaw: 620,
};

test('the entry payload stays within budget, and MapLibre is not in it', () => {
  const entryJs = find(/^index-.*\.js$/);
  const entryCss = find(/^index-.*\.css$/);
  expect(entryJs, 'exactly one entry chunk').toHaveLength(1);
  expect(entryCss, 'exactly one entry stylesheet').toHaveLength(1);

  const initial =
    gzKb(resolve(DIST, 'index.html')) + gzKb(resolve(ASSETS, entryJs[0])) + gzKb(resolve(ASSETS, entryCss[0]));
  expect(initial, `initial payload is ${initial.toFixed(1)} kB gzipped`).toBeLessThan(BUDGET.initial);

  /* The split itself. `maplibregl` appears in the map chunk's source; finding it in the ENTRY
   * chunk means someone replaced the dynamic import with a static one and every reader now
   * pays for the map engine, whichever tab they opened. */
  const entrySource = readFileSync(resolve(ASSETS, entryJs[0]), 'utf8');
  expect(entrySource.includes('maplibregl'), 'MapLibre must not be in the entry chunk').toBe(false);
});

test('the map chunk and its worker stay within budget', () => {
  const mapJs = find(/^MapStage-.*\.js$/);
  const worker = find(/^maplibre-gl-worker-.*\.js$/);
  expect(mapJs, 'MapStage must be its own chunk').toHaveLength(1);
  expect(worker, 'the tile worker must be its own file').toHaveLength(1);

  const chunk = gzKb(resolve(ASSETS, mapJs[0]));
  expect(chunk, `the map chunk is ${chunk.toFixed(1)} kB gzipped`).toBeLessThan(BUDGET.mapChunk);
  const workerSize = rawKb(resolve(ASSETS, worker[0]));
  expect(workerSize, `the tile worker is ${workerSize.toFixed(1)} kB raw`).toBeLessThan(BUDGET.workerRaw);
});

test('nothing but the four known assets ships, so a stray import is visible', () => {
  /* A whitelist rather than a count: a new chunk is not automatically wrong, but it should be
   * something someone decided on. `.map` files are not emitted by this build. */
  const unexpected = readdirSync(ASSETS).filter(
    (f) => !/^(index|MapStage)-.*\.(js|css)$/.test(f) && !/^maplibre-gl-worker-.*\.js$/.test(f),
  );
  expect(unexpected, 'an asset nobody declared is in dist/assets').toEqual([]);
});
