/* The basemap Worker, spec §8.3 — R2 in front, range requests out.
 *
 * WHY THIS EXISTS AT ALL. Cloudflare Pages caps one file at 25 MiB and the z10 Nigeria extract
 * is 39.23 MB. The spec measured the alternative: a z9 extract fits at ~10 MB, but z9 is seven
 * levels below the map's `maxZoom: 16` and carries major roads, water and place points and
 * nothing finer — so an official zooming into their own city, which §1 says is the dashboard's
 * purpose, would find almost nothing under the contours. The user chose R2 plus this Worker on
 * 2026-10-23, which is the standard Protomaps serverless deployment.
 *
 * WHAT IT HAS TO GET RIGHT is range requests. PMTiles reads a 127-byte header, then a
 * directory, then one tile at a time, each as `Range: bytes=a-b`, so a handler that ignores the
 * header returns the same correct-looking 200 for every request and the map draws nothing. That
 * parsing lives in range.mjs with its own tests, because it is the one part testable without
 * Cloudflare and the one part that fails silently.
 *
 * DEPLOYING IT IS NOT THIS REPOSITORY'S JOB and it is not wired into any npm script: the
 * bucket, the account and the custom domain are the user's, and `wrangler deploy` run from a
 * build would be a side effect nobody asked for. README's Deployment section has the four
 * commands, in order.
 *
 * It is plain `.mjs` on purpose: `tsconfig.json` includes `src` and `vite.config.ts`, so a `.ts`
 * file here would look typechecked and would not be. The types that matter are in the JSDoc.
 */
import { parseRange, rangeHeaders } from './range.mjs';

/* The app is served from Pages and this Worker from its own hostname, so every tile read is
 * cross-origin. `Content-Range` and `Content-Length` must be EXPOSED or a browser hands the
 * PMTiles client a response whose own length it cannot read. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, If-Match, If-None-Match',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

/* A year, immutable. The extract is a dated artefact: rebuilding it from a newer Protomaps
 * build produces a different object, and §8.3's workflow uploads it under a new key rather than
 * replacing one in place. A cached tile is therefore never stale for a key that still exists. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** PMTiles is an opaque binary container; there is no registered media type for it. */
const CONTENT_TYPE = 'application/octet-stream';

export default {
  /**
   * @param {Request} request
   * @param {{ BASEMAP: R2Bucket }} env  the binding named in wrangler.toml
   */
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'GET, HEAD, OPTIONS' } });
    }

    /* The key is the path, with no traversal: R2 keys are flat, so `..` is not a directory
     * escape, but a leading slash would be part of the key and would never match. */
    const key = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    if (!key || !key.endsWith('.pmtiles')) {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    /* HEAD is answered from the metadata alone. The PMTiles client uses it to learn the object's
     * size before its first ranged read, so it must carry `Accept-Ranges` and a real length. */
    if (request.method === 'HEAD') {
      const head = await env.BASEMAP.head(key);
      if (!head) return new Response(null, { status: 404, headers: CORS });
      return new Response(null, {
        status: 200,
        headers: {
          ...CORS,
          ...rangeHeaders(null, head.size),
          'Content-Type': CONTENT_TYPE,
          'Cache-Control': CACHE_CONTROL,
          ETag: head.httpEtag,
        },
      });
    }

    /* The size has to be known BEFORE the range can be parsed - a suffix range and a clamped end
     * are both defined against it - so this is a head followed by a get rather than one call.
     * Both are metadata-cheap against R2 and only the second moves bytes. */
    const meta = await env.BASEMAP.head(key);
    if (!meta) return new Response('Not found', { status: 404, headers: CORS });

    const wanted = parseRange(request.headers.get('Range'), meta.size);
    if (wanted === 'unsatisfiable') {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { ...CORS, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${meta.size}` },
      });
    }

    const object = await env.BASEMAP.get(key, wanted ? { range: wanted } : undefined);
    if (!object) return new Response('Not found', { status: 404, headers: CORS });

    return new Response(object.body, {
      status: wanted ? 206 : 200,
      headers: {
        ...CORS,
        ...rangeHeaders(wanted, meta.size),
        'Content-Type': CONTENT_TYPE,
        'Cache-Control': CACHE_CONTROL,
        ETag: object.httpEtag,
      },
    });
  },
};
