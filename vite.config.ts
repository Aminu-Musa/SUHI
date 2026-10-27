// `vitest/config` rather than `vite`: it is the same defineConfig plus the `test` block's types.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Relative asset URLs so the built page also opens from the filesystem, which is how the
    // Task 3 fidelity run compares it side by side with project/nigeria-suhi-dashboard.html.
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './',
  test: {
    // Node stays the default: the existing .mjs suites are pure data/colour maths over files and
    // run faster without a DOM. The two component suites opt in per file with
    // `// @vitest-environment jsdom`, which keeps the jsdom cost where it is actually needed.
    environment: 'node',
    /* The Playwright specs under tests/fidelity are NOT vitest tests - they import
     * @playwright/test and have their own runner and config. Vitest's default include glob
     * picks up any *.spec.ts, so without this exclusion `npm test` fails two files that are
     * perfectly healthy under `npm run fidelity`. */
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/fidelity/**'],
    /* derive.test.mjs round-trips 441 polygons through TopoJSON and measures vertex drift. It
     * needs ~2.2s alone and was observed at 6.5s under full-suite load, which overran the 5s
     * default and made it look like a real regression. The work is genuinely heavy, so the
     * budget is raised rather than the assertion loosened. */
    testTimeout: 30_000,
    // No `globals: true`, so Testing Library's auto-cleanup never registers. Every component
    // suite calls cleanup() in its own afterEach.
    restoreMocks: true,
    /* ONE setup file, with ONE job: reset `window.location` between tests. Spec §8.4 made the
     * URL application state the app writes on every change and reads on every mount, and in
     * jsdom that state is per FILE and survives cleanup() - so without this, a test that
     * switches the tab leaves a deep link behind for the next render in its own file. See
     * src/test-setup.ts for the five tests that measured it. It imports `afterEach` explicitly,
     * so `globals` stays off and every suite still calls cleanup() itself. */
    setupFiles: ['./src/test-setup.ts'],
    /* CSS is PROCESSED rather than stubbed, which vitest does not do by default.
     *
     * One test needs it: spec §9.1 bug 8's `@media (prefers-reduced-motion: reduce)` block is a
     * CSS rule, so the only thing that can regress is the rule going missing - and jsdom does
     * not evaluate media queries, so the assertion has to read the stylesheet's own text.
     * `import app from './app.css?raw'` returns an EMPTY STRING with the default setting, which
     * would have made that test pass having checked nothing. Measured: with this on, the same
     * import returns the file. */
    css: true,
  },
});
