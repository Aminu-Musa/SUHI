/* The REAL data files, as a fixture for the component suites.
 *
 * Not hand-written fixtures, and that is the point: the load-bearing test in this task is the
 * zero-spot case, and it only means anything if the filter combination it uses genuinely
 * selects nothing out of the 441 shipped features. A synthetic fixture could be made to say
 * whatever the test wanted; these three files are the ones the browser fetches.
 *
 * cities.json and clusters.json come through Vite's JSON transform. spots.geojson comes through
 * `?raw` and is parsed here, because Vite treats an unknown extension as an asset and would
 * hand back a URL rather than the data. Reading them with node:fs would have been the obvious
 * alternative and needs @types/node, which is not installed and is not worth adding for this.
 *
 * Test-only. Nothing in the shipped bundle imports this module - the app fetches the same three
 * URLs at runtime (src/app/data.ts), so a megabyte of polygons never reaches the build.
 */

import citiesJson from '../../data/cities.json';
import clustersJson from '../../data/clusters.json';
import spotsRaw from '../../data/spots.geojson?raw';
import type { City, Cluster, Spots, SuhiData } from '../app/data';

export const FIXTURE: SuhiData = {
  cities: citiesJson as unknown as City[],
  clusters: clustersJson as unknown as Cluster[],
  spots: JSON.parse(spotsRaw) as Spots,
};
