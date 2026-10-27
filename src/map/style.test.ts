/* Spec §8.3: the basemap style, validated by the real style-spec validator.
 *
 * `validateStyleMin` is what MapLibre runs on a style before it parses it, so a style that fails
 * here fails in the browser - with a blank map and a console warning, which is not where a
 * typed source-layer name or a malformed filter should be found.
 */

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { expect, test } from 'vitest';
import { THEME_TOKENS } from '../../scripts/lib/tokens.mjs';
import type { Theme } from '../app/ThemeProvider';
import { BASEMAP_ATTRIBUTION, BASEMAP_FILE, PMTILES_SCHEME, basemapSourceUrl, basemapUrl } from './basemap';
import { EMPTY_STATES, STATES_ATTRIBUTION, STATES_SOURCE } from './boundaries';
import { BASEMAP_VARIANTS, BASE_KEYS, MAX_ZOOM, MIN_ZOOM, NATION_LAYER, SOURCE_LAYERS, STATES_LAYER, buildBasemapStyle, variantTheme } from './style';

const THEMES: Theme[] = ['nocturne', 'modernist'];
const BASE = 'http://127.0.0.1:5179/dist/index.html';
const style = (theme: Theme, base: (typeof BASE_KEYS)[number]) => buildBasemapStyle(theme, base, BASE) as Record<string, unknown>;

test('every theme x basemap combination is a VALID MapLibre style', () => {
  for (const theme of THEMES) {
    for (const base of BASE_KEYS) {
      const errors = validateStyleMin(style(theme, base) as never);
      expect(errors.map((e) => `${theme}/${base}: ${e.message}`)).toEqual([]);
    }
  }
});

test('no colour in the style is a var() or a token name - MapLibre cannot read CSS', () => {
  /* The single most likely way to break this file: reach for `var(--hot-4)` because that is
   * what every other part of the UI uses. MapLibre resolves paint once into a parsed style
   * object, so it would receive the literal string and drop the layer. */
  for (const theme of THEMES) {
    for (const base of BASE_KEYS) {
      const json = JSON.stringify(style(theme, base));
      expect(json).not.toMatch(/var\(--/);
      expect(json).not.toMatch(/"--[a-z]/);
    }
  }
});

test('the style is built from THEME_TOKENS, so the two themes really differ', () => {
  const a = JSON.stringify(style('nocturne', 'dark'));
  const b = JSON.stringify(style('modernist', 'light'));
  expect(a).not.toBe(b);
  // And the values present are that theme's own tokens, not an average or an invention.
  expect(a).toContain(THEME_TOKENS.nocturne['--ui-panel']);
  expect(a).toContain(THEME_TOKENS.nocturne['--ui-line-strong']);
  expect(b).toContain(THEME_TOKENS.modernist['--ui-panel']);
});

test('both palettes are FIXED, so the two options differ whatever the UI theme is doing (ruling 39)', () => {
  /* The property ruling 29's three-variant scheme lacked. Its `plain` followed `data-theme`, so
   * in Nocturne it resolved to the nocturne palette and rendered the same picture as `dark` -
   * measured at 209 differing pixels out of 864,000. Two options that look identical read as a
   * broken control, which is exactly how the user reported it. */
  expect(variantTheme('dark', 'modernist')).toBe('nocturne');
  expect(variantTheme('dark', 'nocturne')).toBe('nocturne');
  expect(variantTheme('light', 'nocturne')).toBe('modernist');
  expect(variantTheme('light', 'modernist')).toBe('modernist');

  // And therefore the two styles differ under either UI theme, which is the point.
  for (const theme of THEMES) {
    expect(JSON.stringify(style(theme, 'dark'))).not.toBe(JSON.stringify(style(theme, 'light')));
  }
});

test('every variant draws the full layer set, since ruling 39 removed the reduced-detail mode', () => {
  const ids = (base: (typeof BASE_KEYS)[number]) =>
    ((style('nocturne', base).layers as { id: string }[]) ?? []).map((l) => l.id);
  /* `detail: 'ground'` went with `plain`. It only ever existed to make a third option feel
   * different, and at national zoom it did not even manage that. */
  for (const base of BASE_KEYS) {
    expect(ids(base)).toContain('roads-major');
    expect(ids(base)).toContain('landuse');
  }
  for (const base of BASE_KEYS) {
    expect(ids(base)).toContain('earth');
    expect(ids(base)).toContain('water');
    expect(ids(base)).toContain(NATION_LAYER);
  }
});

test('ruling 30: the national outline is the basemap`s own boundaries at --ui-line-strong, 2px', () => {
  /* The world-atlas fetch is gone, and this is what replaces it. The original styled the atlas
   * outline `color: cssv('--ui-line-strong'), weight: 2, opacity: .9` (prototype line 621), so
   * dropping the CDN costs nothing visually. */
  /* RULING 39: the palette is the VARIANT's, not the UI theme's - so the expected token is
   * resolved through `variantTheme`, not read from `THEME_TOKENS[theme]`. The basemap still
   * follows the theme by DEFAULT, but through ruling 7's latch (which changes the key) rather
   * than through palette resolution. An explicit pick overrides it, exactly as the original's
   * `userPickedBase` did. */
  for (const theme of THEMES) {
    for (const base of BASE_KEYS) {
    const paletteTheme = variantTheme(base, theme);
    const nation = (style(theme, base).layers as Record<string, unknown>[]).find((l) => l.id === NATION_LAYER)!;
    expect(nation['source-layer']).toBe('boundaries');
    expect(nation.filter).toEqual(['==', ['get', 'kind'], 'country']);
    const paint = nation.paint as Record<string, unknown>;
    expect(paint['line-color']).toBe(THEME_TOKENS[paletteTheme]['--ui-line-strong']);
    expect(paint['line-width']).toBe(2);
    expect(paint['line-opacity']).toBe(0.9);
    }
  }
});

test('the State boundaries layer draws NIGERIA`s own ADM1 file, not the basemap (§9.1 bug 6)', () => {
  /* THREE STEPS, and this test is the third. The original drew a `d3.geoGraticule` at 1.6 degree
   * steps whose extent was Nigeria's bounding RECTANGLE, so its lines ran over Niger, Cameroon,
   * Benin and the Bight of Benin - bug 6. The user's 2026-10-24 reversal of ruling 31 replaced
   * it with the basemap's own `boundaries` source-layer at `kind: 'region'` - real admin-level-1
   * lines, but still the wrong EXTENT, because those features carry no country code at any zoom
   * and so the neighbours' first-level divisions rendered too. Task 12 points the layer at
   * `data/boundaries/nga-adm1.topojson`: 37 features, every one `shapeGroup: NGA`.
   *
   * SO THERE IS NO FILTER, and the assertion is that there is none. A filter over a field every
   * feature in the file shares would read as a safeguard while guarding nothing; the guarantee
   * lives in `boundaries.ts`, which refuses the file unless it is 37 Nigerian features.
   *
   * The TREATMENT is still prototype line 625 exactly - `--ui-muted`, 1px, opacity .5, dashed
   * `3 4` - which is what keeps a state line subordinate to the 2px `--ui-line-strong` border. */
  for (const theme of THEMES) {
    for (const base of BASE_KEYS) {
    const paletteTheme = variantTheme(base, theme);
    const layers = style(theme, base).layers as Record<string, unknown>[];
    const states = layers.find((l) => l.id === STATES_LAYER)!;
    expect(states.source).toBe(STATES_SOURCE);
    expect(states['source-layer']).toBeUndefined();
    expect(states.filter).toBeUndefined();
    const paint = states.paint as Record<string, unknown>;
    expect(paint['line-color']).toBe(THEME_TOKENS[paletteTheme]['--ui-muted']);
    expect(paint['line-width']).toBe(1);
    expect(paint['line-opacity']).toBe(0.5);
    expect(paint['line-dasharray']).toEqual([3, 4]);
    /* Subordinate also means UNDERNEATH: the border is pushed last so it paints over the state
     * lines where the two coincide, which they do along the whole frontier. */
    expect(layers.findIndex((l) => l.id === STATES_LAYER)).toBeLessThan(layers.findIndex((l) => l.id === NATION_LAYER));
  }
    }
});

test('both boundary layers survive the `plain` variant, because they are not decoration', () => {
  // `plain` drops roads and landcover. The two boundary layers are what makes a blank ground
  // still legible as Nigeria, so they are in every variant.
  for (const base of BASE_KEYS) {
    const ids = (style('nocturne', base).layers as { id: string }[]).map((l) => l.id);
    expect(ids).toContain(STATES_LAYER);
    expect(ids).toContain(NATION_LAYER);
  }
});

test('no symbol layer and no glyphs endpoint, so no third-party font CDN comes back', () => {
  /* Rulings 29 and 30 exist to remove the third-party map dependencies. A MapLibre symbol layer
   * needs a glyph URL and the only ready one is a Protomaps CDN - for labels the design does
   * not take from the basemap anyway: ruling 13 keeps city labels as DOM `.citylabel` overlays,
   * which are already styled by --color-text and already flip with the theme. */
  for (const base of BASE_KEYS) {
    const s = style('nocturne', base);
    expect(s.glyphs).toBeUndefined();
    expect((s.layers as { type: string }[]).some((l) => l.type === 'symbol')).toBe(false);
    /* The only absolute URLs in a built style are the basemap archive (configured in ONE place)
     * and the THREE attribution links. A glyphs endpoint, a sprite sheet or a font .pbf would
     * show up as a fourth HOST.
     *
     * geoboundaries.org is the third and it is new in Task 12. It is a LICENCE CONDITION rather
     * than a dependency: ODC-ODbL requires attribution for data/boundaries/nga-adm1.topojson,
     * which is served from this origin like every other data file. Nothing is fetched from that
     * host at runtime - it is an href in the attribution control. */
    const hosts = [...JSON.stringify(s).matchAll(/https?:\/\/([^/\\"]+)/g)].map((m) => m[1]);
    expect([...new Set(hosts)].sort()).toEqual([
      '127.0.0.1:5179',
      'openstreetmap.org',
      'protomaps.com',
      'www.geoboundaries.org',
    ]);
    expect(JSON.stringify(s)).not.toMatch(/\.pbf|fonts\.|sprite/);
  }
});

test('every layer reads a source-layer this style declares it reads', () => {
  // A typo in a source-layer name renders nothing and warns nothing, so the set is pinned.
  for (const base of BASE_KEYS) {
    for (const l of style('nocturne', base).layers as Record<string, string>[]) {
      if (l.type === 'background') continue;
      /* A GeoJSON source has no source-layers to name, so the state layer is exempt by KIND
       * rather than by id - `l.source === STATES_SOURCE`. A VECTOR layer that forgot its
       * source-layer still fails here, which is the regression this test exists for. */
      if (l.source === STATES_SOURCE) {
        expect(l['source-layer']).toBeUndefined();
        continue;
      }
      expect(SOURCE_LAYERS as readonly string[]).toContain(l['source-layer']);
    }
  }
});

test('the zoom range is the original`s 5..16, and the source stops at 10 and upscales', () => {
  // Prototype line 610. The archive's z10 ceiling is §8.3's measured compromise; vector tiles
  // upscale without blurring, so `maxzoom` on the SOURCE is what lets the map keep zooming.
  expect([MIN_ZOOM, MAX_ZOOM]).toEqual([5, 16]);
  const src = (style('nocturne', 'dark').sources as Record<string, Record<string, unknown>>).basemap;
  expect(src.maxzoom).toBe(10);
  expect(src.bounds).toEqual([2.5, 3.9, 15.0, 14.1]);
  expect(src.attribution).toBe(BASEMAP_ATTRIBUTION);
});

test('the state source is declared EMPTY and credited, because its data arrives by fetch', () => {
  /* 260 KB of topology expanding to roughly a megabyte of GeoJSON, so it is fetched beside the
   * four data files rather than imported into the entry chunk - Task 12 spent its first commit
   * removing exactly that kind of weight. `MapStage.applyBoundaries` fills it, and re-fills it
   * after every setStyle, because a style rebuild hands back this empty collection. */
  for (const theme of THEMES) {
    for (const base of BASE_KEYS) {
      const src = (style(theme, base).sources as Record<string, Record<string, unknown>>)[STATES_SOURCE];
      expect(src.type).toBe('geojson');
      expect(src.data).toEqual(EMPTY_STATES);
      expect((src.data as { features: unknown[] }).features).toEqual([]);
      expect(src.attribution).toBe(STATES_ATTRIBUTION);
    }
  }
});

test('ruling 29: the basemap URL has exactly ONE home, and production overrides it by config', () => {
  /* Dev reads `public/<file>` resolved against the page (the same reason src/app/data.ts
   * resolves its three files that way: the built page is served from /dist/ by the fidelity
   * harness and from the site root in production). Production sets VITE_BASEMAP_URL to the
   * Cloudflare R2 Worker. Nothing else in the codebase should know either value. */
  expect(basemapUrl(BASE)).toBe(`http://127.0.0.1:5179/dist/${BASEMAP_FILE}`);
  expect(basemapSourceUrl(BASE)).toBe(PMTILES_SCHEME + basemapUrl(BASE));
  expect(basemapSourceUrl(BASE).startsWith('pmtiles://')).toBe(true);
});

test('each variant`s button label is its SECOND word, and dark/topo keep ruling 7`s keys', () => {
  expect(BASE_KEYS).toEqual(['dark', 'light']);
  for (const k of BASE_KEYS) expect(BASEMAP_VARIANTS[k].label.split(' ').length).toBe(2);
});
