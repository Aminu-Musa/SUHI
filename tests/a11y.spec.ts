/* Accessibility, spec §9.1 bug 8 and bug 3 — in a REAL BROWSER, which is the whole point of
 * putting this suite under Playwright rather than beside the component tests.
 *
 * Every claim here was already asserted somewhere in the unit suites, and every one of those
 * assertions reads something other than the thing it claims:
 *
 *   - `Drawer.test.tsx` proves the `prefers-reduced-motion` BLOCK EXISTS by regexing app.css as
 *     text. jsdom does not evaluate media queries, so no unit test can say whether the block
 *     actually suppresses the drawer's slide. (The README records the sharper version of this
 *     trap: the same `?raw` read returned an EMPTY STRING for 18,087 characters of CSS and the
 *     test passed.) Here the browser is asked for the computed `transition-duration` under both
 *     media states, so a block that exists but matches nothing fails.
 *   - `Layers.test.tsx` proves each switch has `role="switch"` and a `tabIndex`. That is not the
 *     same statement as "a reader with no mouse can reach all of them": a tab stop inside an
 *     `aria-hidden` subtree, or behind a container with `display:none`, has a tabIndex and is
 *     unreachable. Here the sweep is a real sequence of real Tab presses.
 *
 * The suite runs against the BUILT page (`/dist/index.html`) and reuses the fidelity harness's
 * `openPage`, so the network is pinned, the theme is seeded and the fonts have settled - the
 * same preconditions, for the same reasons, as the guard next door. It does NOT load the
 * original: the original's accessibility is not what this revision ships.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { REBUILD, openPage, type Theme } from './fidelity/pages';

const THEMES: readonly Theme[] = ['nocturne', 'modernist'];
const TABS = ['map', 'compare', 'table', 'report'] as const;

/* Every element that IS a control - a thing a reader operates - regardless of whether it
 * currently has a tab stop. That independence is the whole design of the test below, and it was
 * learned the hard way: the first version built its expected set from `tabIndex >= 0`, so when a
 * layer switch was mutated to `tabIndex={-1}` to check the test bit, the switch simply left the
 * expected set and the test passed. It was asserting "every tab stop is reachable", which is
 * nearly a tautology, rather than "every control is reachable", which is bug 3.
 *
 * Containers are NOT controls and are excluded by role below; neither are the two canvases
 * (which carry `role="region"`, not a control role) nor Radix's focus-guard spans. */
const CONTROLS = 'a[href], button, select, input, [role="switch"], [role="button"], [role="slider"]';

/* Containers that are focus PROXIES, not controls. Radix implements the roving-tabindex pattern
 * by putting `tabindex="0"` on the group and `-1` on every item, then forwarding focus from the
 * group to the active item - so a Tab press lands on `button[data-v=dark]`, never on
 * `div#baseSeg`, and the group is "reached" through its child. MEASURED, not assumed: a sweep of
 * this page lands on the active item of all five groups (the tablist and the four `.seg`s) and
 * on none of the five groups themselves.
 *
 * Demanding a stop on the group as well as the item would be demanding a worse tab order than
 * the pattern prescribes - two stops for one control - so the groups are excluded here and
 * their non-active items are covered by the arrow-key half of the test instead. */
const PROXY_ROLES = ['tablist', 'radiogroup', 'group'];

/* The four selectors app.css lists under `@media (prefers-reduced-motion: reduce)`, split by
 * what they are actually doing — and the split is the finding, not bookkeeping.
 *
 * `.drawer` and `.tip` carry a transition in the design: a .22s slide of a 378px panel and a
 * .1s opacity fade. Suppressing those is what bug 8 asks for, and this is where the media query
 * does work.
 *
 * `.swipe` and `.swipetag` carry NO transition at any time. Their rules (app.css 168 and 172)
 * declare none, and `Swipe` positions them through inline `left`/`right`, so the `transition:
 * none` the block declares for them suppresses nothing today. The comment in app.css says they
 * are listed so a handle that LATER gains an ease cannot ease behind a dragging pointer, which
 * is a reasonable thing to want - but a test that asserted "0s under reduce" for them would be
 * the README's six-deleted-selectors trap written fresh: an assertion that passes while
 * comparing nothing. They are therefore asserted to be 0s in BOTH states, which is what is
 * true, and the assertion that the media query suppresses something is made only where it does. */
const ANIMATED = ['.drawer', '.tip'] as const;
const NEVER_ANIMATED = ['.swipe', '.swipetag'] as const;

test.describe('spec §9.1 bug 8 — prefers-reduced-motion', () => {
  test('the drawer and the tooltip animate by default and stop under reduce', async ({ page }) => {
    await openPage(page, REBUILD, 'nocturne');

    const read = () =>
      page.evaluate(
        (sels) =>
          sels.map((sel) => {
            const el = document.querySelector(sel);
            return { sel, present: !!el, duration: el ? getComputedStyle(el).transitionDuration : '' };
          }),
        [...ANIMATED, ...NEVER_ANIMATED],
      );

    const still = /^0s(,\s*0s)*$/;

    /* The default half is not a formality. It is what stops this test passing against a page
     * that has no transitions at all - a rebuild that simply dropped the drawer's slide would
     * satisfy the `reduce` assertion and fail this one, which is the correct outcome: §3 makes
     * the original's motion part of the design for readers who have not asked otherwise. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const row of await read()) {
      expect(row.present, `${row.sel} must exist to be measured`).toBe(true);
      if ((ANIMATED as readonly string[]).includes(row.sel)) {
        expect(row.duration, `${row.sel} animates when no preference is expressed`).not.toMatch(still);
      } else {
        expect(row.duration, `${row.sel} has no transition to suppress - see NEVER_ANIMATED`).toMatch(still);
      }
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const row of await read()) {
      expect(row.duration, `${row.sel} must not animate under reduce`).toMatch(still);
    }
  });
});

test.describe('spec §9.1 bug 3 — keyboard reach', () => {
  test('a Tab sweep reaches every tab stop on the Map tab, and the arrow keys reach the other tabs', async ({
    page,
  }) => {
    await openPage(page, REBUILD, 'nocturne');

    /* The inventory is computed from the page rather than written out here on purpose: a
     * hard-coded list of control ids would still pass after someone added a seventh layer
     * toggle with no tab stop, which is exactly the regression bug 3 was.
     *
     * It comes back split in two. `standalone` controls must each be reached by Tab.
     * `roving` ones live inside a group that implements the roving-tabindex pattern, where only
     * the active item is a tab stop and the rest are reached with the arrow keys - so they are
     * covered by the arrow-key assertions at the end, and ROVING_GROUPS below has to account
     * for every one of them. */
    const { standalone, roving } = await page.evaluate(
      ([sel, proxyRoles]) => {
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false;
          if (el.closest('[aria-hidden="true"]')) return false;
          for (let n: Element | null = el; n; n = n.parentElement) {
            const s = getComputedStyle(n);
            if (s.display === 'none' || s.visibility === 'hidden') return false;
          }
          return true;
        };
        const name = (el: Element) => {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const key = el.getAttribute('data-k') ?? el.getAttribute('data-v') ?? el.getAttribute('data-tab') ?? '';
          return `${tag}${id}${key ? `[${key}]` : ''}${el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''}`;
        };

        const controls = [...document.querySelectorAll(sel as string)]
          .filter(visible)
          .filter((el) => !(el as HTMLElement & { disabled?: boolean }).disabled)
          /* Radix's FocusScope sentinels: two zero-opacity, pointer-events:none spans parked on
           * <body> to catch focus leaving the drawer. They are reached by Tab and are not
           * controls. */
          .filter((el) => !el.hasAttribute('data-radix-focus-guard'))
          .filter((el) => !(proxyRoles as string[]).includes(el.getAttribute('role') ?? ''));

        const inGroup = (el: Element) =>
          (proxyRoles as string[]).some((role) => el.parentElement?.closest(`[role="${role}"]`));

        return {
          standalone: controls.filter((el) => !inGroup(el)).map(name),
          roving: controls.filter(inGroup).map(name),
        };
      },
      [CONTROLS, PROXY_ROLES] as const,
    );

    expect(standalone.length, 'the Map tab must offer tab stops to find').toBeGreaterThan(10);
    /* Every roving control belongs to one of the five groups the arrow-key block below walks.
     * Without this, a NEW roving group would quietly park its items in a partition nothing
     * asserts - the same hole the first version of this test had, one level up. */
    expect(roving.sort()).toEqual(
      [
        'button[all]',
        'button[L50]',
        'button[L75]',
        'button[L90]',
        'button[both]',
        'button[hot]',
        'button[cold]',
        'button[pop]',
        'button[area]',
        'button[dark]',
        'button[light]',
        ...['map', 'compare', 'table', 'report'].map((v) => `button#radix-_r_0_-trigger-${v}[${v}].tab`),
      ].sort(),
    );

    /* Focus starts at the document, so the first Tab lands on the first stop in order. The
     * budget is twice the expected count: enough to wrap past the browser's own URL bar stop
     * and come back, far short of an infinite loop if a focus trap closes on us. */
    await page.evaluate(() => document.body.focus());
    const reached = new Set<string>();
    for (let i = 0; i < standalone.length * 2 + 10; i += 1) {
      await page.keyboard.press('Tab');
      const here = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return '';
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const key = el.getAttribute('data-k') ?? el.getAttribute('data-v') ?? el.getAttribute('data-tab') ?? '';
        return `${tag}${id}${key ? `[${key}]` : ''}${el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''}`;
      });
      if (here) reached.add(here);
    }

    const missed = standalone.filter((e) => !reached.has(e));
    expect(missed, `unreachable by Tab: ${missed.join(', ')}`).toEqual([]);

    /* THE ROVING HALF, and it is what pays for excluding the five groups above. Every item
     * inside them carries tabindex=-1 except the active one, so "reachable" for the other
     * fifteen means the arrow keys - and a group that lost its roving behaviour would strand
     * them all while this file's Tab sweep stayed green. */
    await page.locator('.tab[data-tab="map"]').focus();
    for (const tab of ['compare', 'table', 'report'] as const) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator(`.tab[data-tab="${tab}"]`)).toBeFocused();
    }
    /* Back to the Map tab, because the four segments live in the rail and the rail is
     * `display:none` off the Map tab (ruling 5) - an invisible control cannot be focused. */
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.tab[data-tab="map"]')).toBeFocused();

    for (const [seg, items] of [
      ['#contourSeg', ['all', 'L50', 'L75', 'L90']],
      ['#popSeg', ['both', 'hot', 'cold']],
      ['#metricSeg', ['pop', 'area']],
      ['#baseSeg', ['dark', 'light']],
    ] as const) {
      await page.locator(`${seg} button[data-v="${items[0]}"]`).focus();
      for (const v of items.slice(1)) {
        await page.keyboard.press('ArrowRight');
        await expect(page.locator(`${seg} button[data-v="${v}"]`), `${seg} must reach ${v} by arrow`).toBeFocused();
      }
    }
  });
});

test.describe('spec §9.1 bug 8 — aria-live', () => {
  test('a tab change is announced, and the default tab is not', async ({ page }) => {
    await openPage(page, REBUILD, 'nocturne');

    const live = page.locator('#tabLive');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveAttribute('aria-atomic', 'true');

    /* Silent at boot. An announcer that names the default tab on load talks over the page
     * title, which is the one thing a screen reader reads without being asked. */
    await expect(live).toHaveText('');

    /* The region is announced, not seen: it must carry no pixel, because every box on this page
     * is compared against the original next door. */
    const box = await live.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box).toEqual({ w: 1, h: 1 });

    for (const [tab, label] of [
      ['compare', 'Compare cities'],
      ['table', 'Data table'],
      ['report', 'Reports'],
      ['map', 'Map'],
    ] as const) {
      await page.locator(`.tab[data-tab="${tab}"]`).click();
      await expect(live).toHaveText(label);
    }

    /* And it is the DICTIONARY that supplies the text, not an English literal: §10.2 leaves the
     * three Nigerian languages under native review, so an announcer with its own hard-coded
     * prose would be the one string on the page that never gets reviewed. */
    await page.locator('#lang').selectOption('ha');
    await page.locator('.tab[data-tab="table"]').click();
    await expect(live).not.toHaveText('Data table');
    await expect(live).not.toHaveText('');
  });
});

test.describe('axe', () => {
  for (const theme of THEMES) {
    for (const tab of TABS) {
      test(`no violations on the ${tab} tab in ${theme}`, async ({ page }) => {
        await openPage(page, REBUILD, theme);
        if (tab !== 'map') await page.locator(`.tab[data-tab="${tab}"]`).click();
        await page.waitForTimeout(300);

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          /* The canvas the map draws into. MapLibre renders a `<canvas>` with no text
           * alternative and axe cannot know the overlay beside it is the alternative; §7.4's
           * `.ovl` blocks carry the title, the subtitle and the zoom disclosure in text. The
           * EXCLUSION IS THE CANVAS ONLY - every control MapLibre puts in the DOM stays in
           * scope. */
          .exclude('canvas')
          .analyze();

        const summary = violations.map(
          (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`,
        );
        expect(summary, `axe violations on ${tab}/${theme}`).toEqual([]);
      });
    }
  }
});
