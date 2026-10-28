/* Loading the two pages so they are comparable: same theme, same viewport, no network.
 *
 * Three things have to be neutralised or the guard reports differences that say nothing about
 * fidelity:
 *
 * 1. THE CDN. The original fetches countries-110m.json from jsdelivr inside a Promise.all with
 *    its three local files (prototype lines 592-596), so a network blip rejects the whole chain
 *    and the page never leaves its .loading state. A guard that needs the internet fails
 *    randomly, and a guard that fails randomly gets switched off - the same reasoning as ruling
 *    21. Every external request is fulfilled locally with a minimal valid topology.
 * 2. THE STORED THEME. Both pages read localStorage('suhi.theme') at boot (ruling 6), so a
 *    previous run would decide this one's theme. It is seeded before any script evaluates.
 * 3. FONT LOADING. The vendored stylesheets pull Inter and Archivo from Google Fonts. Box and
 *    type comparisons are meaningless mid-swap, so both pages wait on document.fonts.ready. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, Route } from '@playwright/test';

export type Theme = 'nocturne' | 'modernist';

export const ORIGINAL = '/project/nigeria-suhi-dashboard.html';
export const REBUILD = '/dist/index.html';

/* Every external URL the original loads, mapped to a file already in node_modules.
 *
 * Serving these locally is not a convenience - it is what makes the guard mean anything. Left
 * to the network, a blip gives the ORIGINAL a broken Leaflet and an empty map while the rebuild
 * renders fine, and the guard reports dozens of "differences" that are really one dropped
 * request. Offline, both pages are deterministic. (This is also how the harness survived being
 * written on a connection that failed five times in a day.) */
const LOCAL_FOR_CDN: readonly { readonly match: RegExp; readonly file: string; readonly type: string }[] = [
  { match: /leaflet@[\d.]+\/dist\/leaflet\.css/, file: 'node_modules/leaflet/dist/leaflet.css', type: 'text/css' },
  { match: /leaflet@[\d.]+\/dist\/leaflet\.js/, file: 'node_modules/leaflet/dist/leaflet.js', type: 'text/javascript' },
  { match: /d3@[\d.]+\/dist\/d3\.min\.js/, file: 'node_modules/d3/dist/d3.min.js', type: 'text/javascript' },
  { match: /topojson-client@[\d.]+\/dist\/topojson-client\.min\.js/, file: 'node_modules/topojson-client/dist/topojson-client.min.js', type: 'text/javascript' },
];

const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

async function blockExternal(page: Page): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }

    const local = LOCAL_FOR_CDN.find((e) => e.match.test(url));
    if (local) {
      return route.fulfill({
        status: 200,
        contentType: local.type,
        body: readFileSync(resolve(ROOT_DIR, local.file), 'utf8'),
      });
    }

    if (/world-atlas|countries-110m/.test(url)) {
      /* A fixture with a real Nigeria feature, not an empty collection. An empty one makes
       * `.find(f => f.properties.name === 'Nigeria')` return undefined (prototype line 599),
       * and `d3.geoBounds(undefined)` then throws inside initMap - AFTER line 600 has already
       * removed #loading, so the page looks loaded while rendering zero KPIs. Worse, the
       * prototype's own .catch writes to #loading, which no longer exists, so the error handler
       * throws too and the real cause never surfaces. */
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: readFileSync(resolve(ROOT_DIR, 'tests/fidelity/fixtures/countries-110m.json'), 'utf8'),
      });
    }

    /* Google Fonts is fulfilled EMPTY rather than continued. A `continue` on a dead network
     * hangs until timeout and the `load` event never fires - which is exactly how this helper
     * failed the first time it ran. Both pages therefore fall back to the same system family,
     * so every box comparison stays apples-to-apples, and a real font-family divergence is
     * still caught because that is read from computed CSS, not from what loaded. */
    if (/fonts\.googleapis\.com/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '/* fonts stubbed offline */' });
    }
    if (/fonts\.gstatic\.com/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: '' });
    }

    /* Anything else is a request neither page is supposed to make. Failing it loudly is better
     * than a silent 200: a new CDN dependency should surface here, not pass unnoticed. */
    return route.abort('blockedbyclient');
  });
}

/** Opens one page with the theme forced, the network pinned and fonts settled. */
export async function openPage(page: Page, path: string, theme: Theme): Promise<void> {
  await blockExternal(page);
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        /* a blocked store just means the page uses its own default */
      }
      // Both pages set data-theme from script; this only stops a first-paint flash from
      // reaching a screenshot.
      document.documentElement.dataset.theme = value as string;
    },
    ['suhi.theme', theme],
  );
  await page.goto(path, { waitUntil: 'load' });
  /* `.then(() => undefined)` is load-bearing: document.fonts.ready resolves to a FontFaceSet,
   * which Playwright cannot serialise, so returning it directly hangs the call until the test
   * times out - and the failure then surfaces on the OTHER page's goto, which is a genuinely
   * misleading place to go looking. */
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  /* `#map` IS A COMPARED SELECTOR, AND IN THE REBUILD IT NOW ARRIVES IN A CHUNK.
   *
   * Task 12 put `MapStage` behind a dynamic import (see the note in src/app/App.tsx), so on the
   * rebuild the container appears one module fetch after `load` rather than in the first commit.
   * Without this wait the main pass would occasionally capture `#map` as absent and report it as
   * "in the original, missing from the rebuild" - a flake that says nothing about fidelity.
   *
   * The ORIGINAL has `#map` in its static markup, so the wait is instant there and the two pages
   * stay symmetric: this is a wait for a selector BOTH pages are required to have, not a
   * concession to the rebuild. If the chunk ever fails to load, this fails loudly - which is the
   * correct outcome and is exactly what the README's MapLibre-worker near-miss was about. */
  /* 60s, raised from 30s in task 12's fix pass. The review of that task hit this wait once in
   * three runs of the a11y suite - `TimeoutError ... waiting for locator('#map')`, in page load,
   * before any assertion. That suite loads ELEVEN pages where the guard loads four, so it meets
   * a cold start far more often, and a bare 30s is the one budget in this harness that is not
   * covered by the 180s test timeout around it. A load that genuinely never completes still
   * fails, 60s later, which is the outcome the README's MapLibre-worker near-miss wants. */
  await page.waitForSelector('#map', { timeout: 60_000 });
  /* The original REMOVES #loading from the DOM once Promise.all settles (prototype line 600),
   * so `!el` is what fires for it. The rebuild still renders a static `.loading` div that
   * nothing hides until task 6 wires the map, so for that page this predicate is never true and
   * the wait is expected to expire - hence a short timeout and a swallowed rejection.
   *
   * Two API details, both of which cost real time to find:
   *   - `undefined` is passed as the second argument on purpose. The signature is
   *     waitForFunction(pageFunction, ARG, OPTIONS); passing the options object second makes it
   *     the predicate's argument and the options silently default. Measured consequence: a wait
   *     asking for 2 000 ms ran for 178 568 ms and ate the entire test budget, reporting the
   *     failure against the next line.
   *   - `polling: 100` because the default polls on requestAnimationFrame, and the guard keeps
   *     two pages open in one context, so one is always backgrounded - where rAF is throttled
   *     to nothing and the predicate stops being re-evaluated at all.
   */
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('loading');
        return !el || getComputedStyle(el).display === 'none' || el.offsetParent === null;
      },
      undefined,
      { timeout: 2_000, polling: 100 },
    )
    .catch(() => undefined);

  /* NOT requestAnimationFrame. The guard holds two pages open in one context, so one of them
   * is always backgrounded, and a hidden page's rAF is throttled to the point of never firing -
   * a wait on it hangs until the test times out, and the stack then blames whichever page the
   * call was made on. A plain delay is immune to throttling and is all this needs: the pages
   * are already past `load` and `fonts.ready`, so this is slack for layout, not a real gate. */
  await page.waitForTimeout(200);
}
