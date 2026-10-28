/* HTTP range parsing for the basemap Worker (spec §8.3).
 *
 * Split out of the fetch handler so it can be tested without Cloudflare — see range.test.mjs
 * for why this is the part worth testing. Pure functions, no Workers API, no R2.
 */

/** A byte slice of an object, in the shape R2's `get(key, { range })` wants. */
/** @typedef {{ offset: number, length: number }} Slice */

/**
 * Parse one `Range` header against an object of `size` bytes.
 *
 * Returns a {@link Slice} to serve as 206, `null` to serve the whole object as 200, or the
 * string `'unsatisfiable'` to serve 416.
 *
 * The three-way return is deliberate. Collapsing 'unsatisfiable' into `null` would make a
 * request for bytes past the end answer with the ENTIRE 39 MB object under a 200, and the
 * client would read tile data where it expected a directory entry — a wrong map rather than a
 * failed request, which is much harder to notice.
 *
 * @param {string | null | undefined} header
 * @param {number} size
 * @returns {Slice | null | 'unsatisfiable'}
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null; // multi-range, another unit, or nonsense: serve the whole object
  const [, startText, endText] = m;

  // Suffix form, `bytes=-n`: the LAST n bytes. PMTiles does not send it, browsers do.
  if (startText === '') {
    const n = Number(endText);
    if (!endText || !Number.isFinite(n) || n <= 0) return 'unsatisfiable';
    const length = Math.min(n, size);
    return { offset: size - length, length };
  }

  const offset = Number(startText);
  if (!Number.isFinite(offset) || offset >= size) return 'unsatisfiable';

  // Open-ended form, `bytes=a-`: to the end of the object.
  if (endText === '') return { offset, length: size - offset };

  const end = Number(endText);
  if (!Number.isFinite(end)) return null;
  if (end < offset) return null; // a reversed range is malformed, not unsatisfiable
  // RFC 9110: an end past the last byte is clamped, not rejected.
  return { offset, length: Math.min(end, size - 1) - offset + 1 };
}

/**
 * The response headers that describe what is being sent.
 *
 * `Accept-Ranges` is present on EVERY response, including the plain 200: a client that has not
 * yet learned the server supports ranges is exactly the client that needs telling, and PMTiles
 * gives up on an object it cannot read in slices.
 *
 * @param {Slice | null} slice
 * @param {number} size
 * @returns {Record<string, string>}
 */
export function rangeHeaders(slice, size) {
  if (!slice) return { 'Accept-Ranges': 'bytes', 'Content-Length': String(size) };
  const last = slice.offset + slice.length - 1;
  return {
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${slice.offset}-${last}/${size}`,
    'Content-Length': String(slice.length),
  };
}
