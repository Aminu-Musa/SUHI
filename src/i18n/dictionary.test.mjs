import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { D, LANGS, T } from './dictionary.mjs';

describe('dictionary', () => {
  it('gives every key four entries', () => {
    for (const [k, v] of Object.entries(D)) {
      expect(v, k).toHaveLength(4);
      for (const s of v) expect(typeof s, k).toBe('string');
    }
  });

  // Review Focus 4 — a stripped diacritic is a silent downgrade
  it('preserves Igbo dot-below and Yoruba tone marks', () => {
    expect(D.pop_in_hot[2]).toContain('Ọnụọgụ');
    expect(D.pop_in_hot[3]).toContain('ènìyàn');
  });

  it('keeps every non-English string in NFC and free of mojibake', () => {
    for (const [k, v] of Object.entries(D)) {
      for (const s of v.slice(1)) {
        expect(s.normalize('NFC'), k).toBe(s);
        expect(s, k).not.toMatch(/Â|â€|Ã/);
      }
    }
  });

  it('contains real combining marks, so the NFC test is exercising something', () => {
    // 'ọ́' has no single precomposed code point; NFC being a fixed point is what
    // the all-strings NFC test checks. Here we only prove the fixture has marks.
    const s = D.method[3]; // 'Ọ̀nà'
    expect(s.normalize('NFC')).toBe(s);
    expect(s.normalize('NFD')).not.toBe(s);
  });

  // MODIS and Gi* are deliberately NOT listed: they reach the UI through markup
  // and concatenation ('MODIS ' + T('hotdays'), Gi* in the HTML), not as
  // dictionary values, so there is nothing here to enforce.
  it('leaves scientific vocabulary untranslated so numbers can be checked against the paper', () => {
    for (const term of ['SUHI', 'LST', 'Benjamini', 'Hochberg', 'Sen']) {
      const hits = Object.values(D).filter((v) => v[0].includes(term));
      expect(hits.length, term + ' no longer appears in any English string').toBeGreaterThan(0);
      for (const v of hits) for (const s of v) expect(s, term).toContain(term);
    }
  });

  it('renders the headline template in all four languages', () => {
    for (const lang of LANGS) {
      expect(T('headline', lang).replace('{n}', '137,470')).toContain('137,470');
    }
  });

  it('offers a scoped headline variant with {n} and {scope} in every language', () => {
    for (const lang of LANGS) {
      const s = T('headline_scoped', lang);
      expect(s, lang).toContain('{n}');
      expect(s, lang).toContain('{scope}');
    }
  });

  it('falls back to the key for unknown keys and to English for unknown languages', () => {
    expect(T('no_such_key', 'yo')).toBe('no_such_key');
    expect(T('tab_map', 'xx')).toBe(D.tab_map[0]);
  });

  it('matches the source dictionary verbatim (apart from headline keys)', () => {
    const html = readFileSync(new URL('../../project/nigeria-suhi-dashboard.html', import.meta.url), 'utf8');
    const start = html.indexOf('const D={');
    const end = html.indexOf('};\nconst LANGS', start);
    const src = new Function(`return ${html.slice(start + 'const D='.length, end + 1)}`)();
    const mine = { ...D };
    delete mine.headline;
    delete mine.headline_scoped;
    expect(mine).toEqual(src);
    expect(Object.keys(mine)).toEqual(Object.keys(src));
  });
});
