/* `topojson-client` ships no types and has no @types package, exactly like `topojson-server`
 * next door. Only the two functions this repository calls are declared, and deliberately so: a
 * fuller hand-written surface is a fuller surface to drift.
 *
 * `feature()` is what src/map/boundaries.ts turns `data/boundaries/nga-adm1.topojson` into a
 * GeoJSON FeatureCollection with - a 260 KB topology against the ~1 MB of GeoJSON it expands to,
 * which is why the archive ships as TopoJSON and is converted in the browser.
 *
 * The return is typed loosely on purpose. `feature()` gives a Feature for a single geometry and a
 * FeatureCollection for a GeometryCollection, and narrowing that properly would mean encoding
 * TopoJSON's own union here; `boundaries.ts` validates the shape it actually got instead, which
 * is the check that matters when the input is a file on disk. */
declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): unknown;
  export function quantize<T>(topology: T, transform: number | unknown): T;
}
