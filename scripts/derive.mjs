import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriveCities, deriveCitiesByPeriod, deriveClusters, serialize } from './lib/derive.mjs';
import { buildTopology } from './lib/topo.mjs';

const dataUrl = (name) => new URL(`../data/${name}`, import.meta.url);

/** Read `data/spots.geojson` and write the derived city and cluster tables and `spots.topo.json` beside it. */
export async function main() {
  const fc = JSON.parse(await readFile(dataUrl('spots.geojson'), 'utf8'));
  const outputs = [
    ['cities.json', deriveCities(fc)],
    ['clusters.json', deriveClusters(fc)],
    // Ruling 36. Through the SAME `serialize`, so it gets the same LF-only, BOM-free
    // formatting the other two have and the byte-for-byte guard on it means what theirs do.
    ['cities-by-period.json', deriveCitiesByPeriod(fc)],
  ];

  for (const [name, rows] of outputs) {
    const target = dataUrl(name);
    // 'utf8' with no BOM; serialize emits LF only, and .gitattributes pins eol=lf.
    await writeFile(target, serialize(rows), 'utf8');
    console.log(`wrote ${fileURLToPath(target)} (${rows.length} rows)`);
  }

  // Compact on purpose: every visitor downloads this before the first polygon draws.
  const topoTarget = dataUrl('spots.topo.json');
  await writeFile(topoTarget, `${JSON.stringify(buildTopology(fc))}\n`, 'utf8');
  console.log(`wrote ${fileURLToPath(topoTarget)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
