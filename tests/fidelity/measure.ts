/* One measurement pass per page. Kept separate from the assertions because the cost here is
 * page loads, not comparisons: each page pulls Leaflet, d3 and 441 polygons, so the suite is
 * structured to load four pages total (two themes x two pages) and assert many times over the
 * captured data. An earlier version put each assertion in its own test and timed out at twenty
 * page loads - correct logic, unrunnable shape.
 *
 * ══ TASK 12: EVERY MATCH, NOT THE FIRST ══
 *
 * This file used to call `document.querySelector(sel)` and measure the FIRST match. Task 5
 * found what that costs and the finding was carried here, because changing the capture shape
 * mid-plan would have churned every task's baseline:
 *
 *   - `#cluster` hides behind `.search`: the rail has a search input and a cluster select, both
 *     `.search`, so the bare selector only ever reported the input.
 *   - `.dl2`, `.card2`, `.kpi`, `.kpis`, `.bar`, `.rowlist` and `.rw` all repeat across the
 *     rail, the drawer and the Compare panel. One match each meant the second and third copies
 *     were never compared, and the drawer's set had to be scoped by hand (DRAWER_SELECTORS) to
 *     say anything at all about them.
 *
 * So a selector now yields a measurement per match, and the capture also records HOW MANY it
 * found - which turns out to be the more valuable half: a rebuild that renders 54 `.pk` buttons
 * where the original renders 55 was previously invisible to the guard, because match zero was
 * identical on both pages.
 *
 * KEYS STAY BACKWARD COMPATIBLE. Match 0 keeps the bare selector as its key, so every existing
 * `boxes['.picker']` lookup, every ALLOWED_DIFFS target and every PENDING entry reads exactly
 * as before; later matches are suffixed `«2»`, `«3»`. The guillemets are deliberate - they
 * cannot appear in a CSS selector, so a key can always be split back into selector and index.
 */
import type { Page } from '@playwright/test';

export const TYPE_PROPS = ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform'] as const;
export const BOX_PROPS = ['padding', 'margin', 'border-width', 'border-radius', 'display', 'gap'] as const;

/** How many matches of one selector are measured. See CAP_REASON. */
export const MATCH_CAP = 8;

/* Why a cap at all: `table.dt td` matches 935 nodes (55 rows x 17 columns) and `.pk` 55, so an
 * uncapped capture would serialise thousands of boxes per page per pass to re-assert the same
 * rule. Eight is above every structurally distinct repeat in this design - the most any selector
 * has is the six `.ly` rows and the three places `.dl2` appears - and the COUNT is compared
 * uncapped, so a missing 55th button is still caught even though it is never measured. */
export const CAP_REASON = `measured matches are capped at ${MATCH_CAP}; counts are compared in full`;

export interface Measured {
  readonly present: boolean;
  readonly width: number;
  readonly height: number;
  readonly style: Record<string, string>;
}

export interface Capture {
  readonly tokens: Record<string, string>;
  readonly boxes: Record<string, Measured>;
  /** Matches found per selector, uncapped — so a count difference is a difference. */
  readonly counts: Record<string, number>;
}

/** The key match `index` of `selector` is stored under. Index 0 keeps the bare selector. */
export function matchKey(selector: string, index: number): string {
  return index === 0 ? selector : `${selector} «${index + 1}»`;
}

/** The selector a key came from — `matchKey` reversed. Guillemets cannot occur in a selector. */
export function selectorOf(key: string): string {
  return key.split(' «')[0];
}

export async function capture(page: Page, tokenNames: string[], selectors: readonly string[]): Promise<Capture> {
  return page.evaluate(
    ([names, sels, typeProps, boxProps, cap]) => {
      const cs = getComputedStyle(document.documentElement);
      const tokens: Record<string, string> = {};
      for (const n of names as string[]) tokens[n] = cs.getPropertyValue(n).trim();

      const boxes: Record<string, Measured> = {} as Record<string, Measured>;
      const counts: Record<string, number> = {};
      const measure = (el: HTMLElement): Measured => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const style: Record<string, string> = {};
        for (const p of [...(typeProps as string[]), ...(boxProps as string[])]) style[p] = s.getPropertyValue(p);
        return {
          present: true,
          width: Math.round(r.width * 100) / 100,
          height: Math.round(r.height * 100) / 100,
          style,
        };
      };

      for (const sel of sels as string[]) {
        const found = [...document.querySelectorAll(sel)] as HTMLElement[];
        counts[sel] = found.length;
        if (found.length === 0) {
          boxes[sel] = { present: false, width: 0, height: 0, style: {} };
          continue;
        }
        found.slice(0, cap as number).forEach((el, i) => {
          boxes[i === 0 ? sel : `${sel} «${i + 1}»`] = measure(el);
        });
      }
      return { tokens, boxes, counts };
    },
    [tokenNames, selectors, TYPE_PROPS, BOX_PROPS, MATCH_CAP] as const,
  );
}
