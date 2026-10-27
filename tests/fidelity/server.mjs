/* A static file server rooted at the REPOSITORY ROOT, which is the only root that serves both
 * pages the fidelity guard compares.
 *
 * The original fetches `../data/cities.json` relative to project/nigeria-suhi-dashboard.html
 * (prototype lines 592-596), so it resolves to /data/*.json only when the server root is the
 * repo. `.claude/launch.json` serves `--directory project`, where that path escapes the root and
 * 404s - the prototype cannot load its data under that config at all (ruling 22).
 *
 * Both pages therefore live under one origin and one port:
 *   original -> /project/nigeria-suhi-dashboard.html
 *   rebuild  -> /dist/index.html   (vite `base: './'`, so its assets are relative)
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const PORT = Number(process.env.FIDELITY_PORT ?? 5179);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.pmtiles': 'application/octet-stream',
};

const server = createServer(async (req, res) => {
  // normalize() collapses the `..` the prototype's own fetches contain, then the prefix check
  // rejects anything that still points outside the repo.
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const path = join(ROOT, normalize(url));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('outside root');
    return;
  }
  try {
    const s = await stat(path);
    const file = s.isDirectory() ? join(path, 'index.html') : path;
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});

/* An already-listening port is NOT a failure here.
 *
 * Playwright's `reuseExistingServer` expects to find one already up, and the run config in
 * .claude/launch.json starts this same server by hand - so a stale instance from an earlier run
 * made `npm run fidelity` and the launch config both die on EADDRINUSE with an unhandled 'error'
 * event. A static file server is idempotent: if one is already serving this root, the correct
 * behaviour is to say so and step aside.
 *
 * It does check WHAT is listening before stepping aside, because exiting 0 on a port held by
 * something else would hand Playwright a server serving the wrong files, and the whole fidelity
 * guard would then measure whatever that was. */
server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/project/nigeria-suhi-dashboard.html`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.log(`fidelity server already listening on http://127.0.0.1:${PORT} - reusing it`);
      process.exit(0);
    }
    console.error(`port ${PORT} is in use by something that is not this server (HTTP ${res.status})`);
  } catch (probe) {
    console.error(`port ${PORT} is in use and did not answer a probe: ${probe.message}`);
  }
  process.exit(1);
});

server.listen(PORT, () => console.log(`fidelity server on http://127.0.0.1:${PORT} (root ${ROOT})`));
