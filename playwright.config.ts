/* The fidelity guard (spec §3). It is the only thing that makes "pixel-for-pixel" a
 * requirement rather than an intention, so it runs in CI from task 3 on.
 *
 * One server, rooted at the repo, serves both pages - see tests/fidelity/server.mjs for why the
 * root cannot be project/. The rebuild is compared as BUILT output (/dist), not as a dev server:
 * a config that only looks right under `vite dev` is a broken deliverable.
 *
 * Chromium only, and deliberately. The guard compares the rebuild against the original in the
 * SAME engine; cross-browser rendering differences would be noise with no bearing on whether we
 * transcribed the design faithfully. Browser coverage is a different question from fidelity. */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.FIDELITY_PORT ?? 5179);

/* An escape hatch for a machine that cannot run `npx playwright install`.
 *
 * CI does run it (.github/workflows/ci.yml) and leaves this unset, so the pinned browser is
 * what the guard measures there - which matters, because a Chromium a few builds apart lays
 * text out a fraction differently and the fidelity guard compares boxes to 0.01px. On a sandbox
 * with its own prebuilt Chromium and no download, point this at it and the suites run; the
 * guard is then comparing two pages in THAT engine, which is still the question it asks (both
 * pages, one engine), while the a11y suite below does not depend on the build at all. */
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  /* `./tests`, not `./tests/fidelity`, since Task 12: `tests/a11y.spec.ts` is the second suite
   * that needs a real browser, and for the same reason the guard does. jsdom evaluates no media
   * query, computes no transition and moves no focus, so `prefers-reduced-motion` and a Tab
   * sweep cannot be asserted beside the component tests - see the header of that file. The two
   * npm scripts stay separate (`fidelity` and `a11y`) so a failure names which contract broke. */
  testDir: './tests',
  /* Always rebuilds /dist first - see the file for the stale-output near-miss that put it here. */
  globalSetup: './tests/fidelity/global-setup.ts',
  /* Serial, and measured rather than assumed. The ORIGINAL page costs ~25 s to load: Leaflet,
   * d3, 441 contour polygons and the geometry exaggeration pass (ruling 9). Two workers each
   * loading it at once contend for CPU and both get slower, which is how this suite first
   * failed - ten tests timing out on a machine that could load any one page in under a second.
   * One worker, a generous budget, and a shape that loads four pages in total. */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // a flaky fidelity guard is worse than none: every failure must mean something
  // Two heavy page loads plus two capture passes per test, against a ~25 s original.
  timeout: 180_000,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // A fixed viewport: the original has no @media query at any width (spec §7.8), so one size
    // is the whole story, and a varying viewport would make every box comparison meaningless.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ...devices['Desktop Chrome'],
  },
  /* ONE project. Each spec loops over both themes itself, because a theme here is a
   * `data-theme` attribute the page sets from localStorage - not a Playwright capability - so a
   * per-theme project would run every test twice against the same two themes: a 2x2 cross
   * product where only the diagonal means anything. */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM, args: ['--no-sandbox'] } } : {}),
      },
    },
  ],
  webServer: {
    // Serving only. The build is in globalSetup, because a reused server skips this command
    // entirely and the guard would then measure stale dist output.
    command: 'node tests/fidelity/server.mjs',
    url: `http://127.0.0.1:${PORT}/project/nigeria-suhi-dashboard.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
