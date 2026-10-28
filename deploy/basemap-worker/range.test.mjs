/* The one part of the basemap Worker that can be tested without Cloudflare, and the one part
 * that matters: PMTiles is a RANGE-REQUEST format. The client reads a 127-byte header, then a
 * directory, then one tile at a time, each as `Range: bytes=a-b`. A Worker that ignores the
 * header and returns the whole 39 MB object answers every request with the same correct-looking
 * 200 and the map draws nothing - which is the exact shape of the MapLibre-worker near-miss the
 * README opens with, one layer further out.
 *
 * So the parsing and the response headers are a module of their own, with these tests, rather
 * than inline in a fetch handler nothing can run here.
 */
import { describe, expect, it } from 'vitest';
import { parseRange, rangeHeaders } from './range.mjs';

const SIZE = 39_230_000;

describe('parseRange', () => {
  it('reads the form PMTiles actually sends: a closed interval', () => {
    expect(parseRange('bytes=0-16383', SIZE)).toEqual({ offset: 0, length: 16384 });
    expect(parseRange('bytes=1000-1999', SIZE)).toEqual({ offset: 1000, length: 1000 });
  });

  it('reads an open-ended range as "to the end of the object"', () => {
    expect(parseRange('bytes=39229000-', SIZE)).toEqual({ offset: 39229000, length: 1000 });
  });

  it('reads a suffix range as the last n bytes', () => {
    expect(parseRange('bytes=-127', SIZE)).toEqual({ offset: SIZE - 127, length: 127 });
    // Longer than the object: the whole object, not a negative offset.
    expect(parseRange('bytes=-99999999', SIZE)).toEqual({ offset: 0, length: SIZE });
  });

  it('clamps an end past the object rather than failing, as RFC 9110 requires', () => {
    expect(parseRange('bytes=39229000-99999999', SIZE)).toEqual({ offset: 39229000, length: 1000 });
  });

  it('returns null for no header, so the caller serves a plain 200', () => {
    expect(parseRange(null, SIZE)).toBeNull();
    expect(parseRange('', SIZE)).toBeNull();
  });

  it('returns UNSATISFIABLE for a range that cannot be served, which is a 416 not a 200', () => {
    /* Returning null here would be the dangerous failure: the Worker would answer a request for
     * bytes past the end with the ENTIRE object and a 200, and the client would parse 39 MB of
     * tile data as a directory entry. */
    expect(parseRange('bytes=99999999-', SIZE)).toBe('unsatisfiable');
    expect(parseRange(`bytes=${SIZE}-`, SIZE)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', SIZE)).toBe('unsatisfiable');
  });

  it('returns null for a form it does not understand, rather than guessing', () => {
    // Multi-range is legal HTTP and PMTiles never sends it; serving the first part silently
    // would be wrong, so it falls back to the whole object.
    expect(parseRange('bytes=0-99,200-299', SIZE)).toBeNull();
    expect(parseRange('items=0-99', SIZE)).toBeNull();
    expect(parseRange('bytes=abc-def', SIZE)).toBeNull();
    expect(parseRange('bytes=500-100', SIZE)).toBeNull();
  });
});

describe('rangeHeaders', () => {
  it('describes the slice, not the object, which is what makes the next read correct', () => {
    const h = rangeHeaders({ offset: 1000, length: 1000 }, SIZE);
    expect(h['Content-Range']).toBe(`bytes 1000-1999/${SIZE}`);
    expect(h['Content-Length']).toBe('1000');
  });

  it('always advertises range support, because a client that does not ask gets nothing useful', () => {
    expect(rangeHeaders(null, SIZE)['Accept-Ranges']).toBe('bytes');
    expect(rangeHeaders({ offset: 0, length: 10 }, SIZE)['Accept-Ranges']).toBe('bytes');
  });

  it('gives the whole object its own length when there is no range', () => {
    const h = rangeHeaders(null, SIZE);
    expect(h['Content-Length']).toBe(String(SIZE));
    expect(h['Content-Range']).toBeUndefined();
  });
});
