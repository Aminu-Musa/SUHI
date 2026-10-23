/* Vite's own ambient types: `import.meta.env`, and the module declarations for the query
 * suffixes Vite resolves (`?raw`, `?url`, `?inline`) plus asset imports.
 *
 * It is referenced rather than hand-written because `vite` is already a devDependency and ships
 * these declarations - adding `@types/node` or re-declaring Node's fs/path to let the component
 * suites read a fixture off disk would both be new surface for no gain. `?raw` gives the test
 * files the real data/spots.geojson as a string through the same transform pipeline that serves
 * the app, with no dependency added and nothing to keep in step.
 */

/// <reference types="vite/client" />
