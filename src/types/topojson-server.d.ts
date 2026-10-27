/* `topojson-server` ships no types and has no @types package. Declared here rather than typed
 * as `any` at the call site, so `topology()`'s shape is written down once.
 *
 * The package exposes `module: src/index.js` - plain browser-safe ESM with no node built-ins -
 * which is why src/lib/export.ts can import it at all. scripts/lib/topo.mjs imports the same
 * module from Node; this declaration is for the TypeScript side only. */
declare module 'topojson-server' {
  export interface Topology {
    type: 'Topology';
    objects: Record<string, unknown>;
    arcs: number[][][];
    bbox?: number[];
    transform?: { scale: [number, number]; translate: [number, number] };
  }
  export function topology(objects: Record<string, unknown>, quantization?: number): Topology;
}
