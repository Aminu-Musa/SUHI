/* One measurement pass per page. Kept separate from the assertions because the cost here is
 * page loads, not comparisons: each page pulls Leaflet, d3 and 441 polygons, so the suite is
 * structured to load four pages total (two themes x two pages) and assert many times over the
 * captured data. An earlier version put each assertion in its own test and timed out at twenty
 * page loads - correct logic, unrunnable shape. */
import type { Page } from '@playwright/test';

export const TYPE_PROPS = ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform'] as const;
export const BOX_PROPS = ['padding', 'margin', 'border-width', 'border-radius', 'display', 'gap'] as const;

export interface Measured {
  readonly present: boolean;
  readonly width: number;
  readonly height: number;
  readonly style: Record<string, string>;
}

export interface Capture {
  readonly tokens: Record<string, string>;
  readonly boxes: Record<string, Measured>;
}

export async function capture(page: Page, tokenNames: string[], selectors: readonly string[]): Promise<Capture> {
  return page.evaluate(
    ([names, sels, typeProps, boxProps]) => {
      const cs = getComputedStyle(document.documentElement);
      const tokens: Record<string, string> = {};
      for (const n of names as string[]) tokens[n] = cs.getPropertyValue(n).trim();

      const boxes: Record<string, Measured> = {} as Record<string, Measured>;
      for (const sel of sels as string[]) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) {
          boxes[sel] = { present: false, width: 0, height: 0, style: {} };
          continue;
        }
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const style: Record<string, string> = {};
        for (const p of [...(typeProps as string[]), ...(boxProps as string[])]) style[p] = s.getPropertyValue(p);
        boxes[sel] = {
          present: true,
          width: Math.round(r.width * 100) / 100,
          height: Math.round(r.height * 100) / 100,
          style,
        };
      }
      return { tokens, boxes };
    },
    [tokenNames, selectors, TYPE_PROPS, BOX_PROPS] as const,
  );
}
