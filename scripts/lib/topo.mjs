import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { quantize } from 'topojson-client';

/**
 * Quantization grid: steps across the bounding box. Nigeria spans ~11 degrees, so
 * 1e5 steps is ~11 m: the same resolution as the 4-decimal source and well under one
 * pixel (~19 m) at zoom 13, the deepest the dashboard draws. DELIBERATELY not coarser:
 * 5e4 (~22 m) already exceeds a pixel at z13, and it saves only ~1.5% of the file.
 */
export const QUANTIZATION = 1e5;

/**
 * Visvalingam minimum triangle area, in square degrees. 0 means simplification is OFF,
 * deliberately. Measured on this data: even 1e-10 (~1 m^2) deletes a spike vertex that
 * moves a contour 267 m, because a long thin spike has a tiny triangle area, while
 * saving only 0.03% of the file. Tolerances large enough to matter (1e-7: -11%) are
 * worse. Quantization alone keeps every vertex within 8 m.
 */
export const SIMPLIFY_MIN_WEIGHT = 0;

/**
 * Build the TopoJSON topology, object name `spots`, from the spots FeatureCollection.
 * When minWeight > 0, simplify needs the unquantized, presimplified arcs, so quantize
 * runs last; it delta-encodes the points and strips the presimplify z values.
 */
export function buildTopology(fc, { quantization = QUANTIZATION, minWeight = SIMPLIFY_MIN_WEIGHT } = {}) {
  const topo = topology({ spots: fc });
  return quantize(minWeight > 0 ? simplify(presimplify(topo), minWeight) : topo, quantization);
}
