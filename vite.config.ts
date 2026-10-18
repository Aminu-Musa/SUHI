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
    // No `globals: true`, so Testing Library's auto-cleanup never registers. Every component
    // suite calls cleanup() in its own afterEach.
    restoreMocks: true,
  },
});
