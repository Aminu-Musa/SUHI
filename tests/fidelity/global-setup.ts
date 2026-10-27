/* Rebuild /dist before every fidelity run, unconditionally.
 *
 * This exists because of a near-miss. The build used to live in the webServer command
 * (`npm run build && node server.mjs`), and `reuseExistingServer` is true outside CI - so when
 * a server was already up, the server command never ran, the build never ran, and the guard
 * compared the rebuild's STALE dist output against the original. Proven: changing
 * `.rail{width:332px}` to 330px passed the guard. A fidelity guard reading stale output is
 * worse than no guard, because it reports success.
 *
 * globalSetup runs regardless of whether the server is reused, which is the property needed.
 *
 * ══ TASK 12: THE BUILD IS ALSO WHERE THE BASEMAP URL IS CHOSEN ══
 *
 * CI had NO BASEMAP AT ALL. `public/nigeria-z10.pmtiles` is 39 MB and gitignored (`*.pmtiles`),
 * Vite copies `public/` into `dist/`, so a local run tested against a real archive while CI ran
 * against a 404 - and still reported green, because every compared selector resolves its box and
 * its type from CSS rather than from tiles. CI passing while testing strictly less than the dev
 * loop is the opposite of what a gate is for.
 *
 * `tests/fidelity/fixtures/nigeria-ci.pmtiles` is committed for this: 565 KB, Nigeria bbox,
 * zoom 0-5. Zoom 5 is the map's own `minZoom` and the zoom `fitNation` lands on, so it covers
 * exactly the view the guard screenshots.
 *
 * THE RULE, and it is deliberately two clauses:
 *
 *   1. `process.env.CI` is set            -> the fixture, always.
 *   2. `public/nigeria-z10.pmtiles` absent -> the fixture.
 *
 * Clause 1 is what makes CI DETERMINISTIC: without it, a CI image that happened to carry a full
 * extract (a cache restore, a future artefact step) would test a different archive from every
 * other CI run, and the guard's whole value is that two runs of it mean the same thing. Clause 2
 * is for the contributor who has not cut an extract yet - their first `npm run fidelity` renders
 * a basemap instead of a blank ground, which is the difference between reading the README and
 * believing the map is broken.
 *
 * A LOCAL RUN WITH THE FULL EXTRACT PRESENT KEEPS IT, so the dev loop still tests the real
 * archive at the real ceiling. The fixture is the floor, not the replacement.
 *
 * The URL is ROOT-RELATIVE and therefore port-independent: `tests/fidelity/server.mjs` is rooted
 * at the repository, serves `.pmtiles` with a Content-Type and - since this task - with HTTP
 * range support, which is what an archive is actually read with. An absolute
 * `http://127.0.0.1:5179/...` would bake FIDELITY_PORT into dist.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** What `basemapUrl()` returns when `VITE_BASEMAP_URL` is set - see src/map/basemap.ts. */
export const CI_FIXTURE_URL = '/tests/fidelity/fixtures/nigeria-ci.pmtiles';

/** Exported so `selfcheck.spec.ts` can assert the rule rather than restate it. */
export function basemapUrlForBuild(root: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.VITE_BASEMAP_URL) return env.VITE_BASEMAP_URL; // an explicit choice always wins
  if (env.CI) return CI_FIXTURE_URL;
  return existsSync(resolve(root, 'public', 'nigeria-z10.pmtiles')) ? undefined : CI_FIXTURE_URL;
}

export default function globalSetup(): void {
  const root = resolve(import.meta.dirname, '..', '..');
  const basemap = basemapUrlForBuild(root);
  if (basemap) {
    console.log(`fidelity: building with VITE_BASEMAP_URL=${basemap}`);
  } else {
    console.log('fidelity: building against the full local extract in public/');
  }
  execFileSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: basemap ? { ...process.env, VITE_BASEMAP_URL: basemap } : process.env,
  });
}
