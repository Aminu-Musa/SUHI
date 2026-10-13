import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriveCities, deriveClusters, serialize } from './lib/derive.mjs';

const dataUrl = (name) => new URL(`../data/${name}`, import.meta.url);

/** Read `data/spots.geojson` and write the derived city and cluster tables beside it. */
export async function main() {
  const fc = JSON.parse(await readFile(dataUrl('spots.geojson'), 'utf8'));
  const outputs = [
    ['cities.json', deriveCities(fc)],
    ['clusters.json', deriveClusters(fc)],
  ];

  for (const [name, rows] of outputs) {
    const target = dataUrl(name);
    // 'utf8' with no BOM; serialize emits LF only, and .gitattributes pins eol=lf.
    await writeFile(target, serialize(rows), 'utf8');
    console.log(`wrote ${fileURLToPath(target)} (${rows.length} rows)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
