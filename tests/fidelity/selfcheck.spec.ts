/* The harness proving itself, before anyone trusts it against the rebuild.
 *
 * Both sides load the ORIGINAL. A harness that cannot tell the original from itself proves
 * nothing when it later reports the rebuild as clean - and the ways it can fail that way are
 * mundane: a selector list that matches nothing, a measurement that returns the same constant
 * for every element, a page that never finished loading on one side.
 *
 * Deleted once the suite has run green? No - it stays. It is the control that keeps the other
 * two files meaningful as they grow. */
import { expect, test } from '@playwright/test';
import { ORIGINAL, openPage, type Theme } from './pages';

const PROBE = ['.app', '.top', '.brand', '.tabs', '.tab', '.rail', '.stage', '.mapwrap', '.panel', '.lede'] as const;

for (const theme of ['nocturne', 'modernist'] as Theme[]) {
  test(`[${theme}] SELF-CHECK: the original compared against itself reports zero differences`, async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await openPage(a, ORIGINAL, theme);
    await openPage(b, ORIGINAL, theme);

    const grab = (p: import('@playwright/test').Page) =>
      p.evaluate((list) => {
        const out: Record<string, string> = {};
        for (const s of list as string[]) {
          const el = document.querySelector(s) as HTMLElement | null;
          if (!el) { out[s] = 'ABSENT'; continue; }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          out[s] = [
            Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100,
            cs.fontFamily, cs.fontSize, cs.fontWeight, cs.display, cs.padding,
          ].join('|');
        }
        return out;
      }, PROBE as unknown as string[]);

    const [x, y] = await Promise.all([grab(a), grab(b)]);
    await ctx.close();

    const absent = PROBE.filter((s) => x[s] === 'ABSENT');
    expect(absent, 'the probe selectors must exist in the original, or the harness measures nothing').toEqual([]);

    const diffs = PROBE.filter((s) => x[s] !== y[s]).map((s) => `${s}: ${x[s]} vs ${y[s]}`);
    expect(diffs, 'the original differs from itself, so the harness is not deterministic').toEqual([]);

    // And the measurement must be discriminating: if every element reported the same string the
    // comparison above would pass while measuring nothing real.
    expect(new Set(Object.values(x)).size, 'measurement is not discriminating between elements').toBeGreaterThan(5);
  });
}
