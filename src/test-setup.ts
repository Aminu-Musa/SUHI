/* ONE job: put the document's URL back after every test.
 *
 * WHY THIS FILE EXISTS, as of Task 11. Spec §8.4 makes `window.location.search` a piece of
 * APPLICATION STATE that the app writes to on every change and reads back on every mount. In
 * jsdom that state is per FILE and survives `cleanup()`, so a test that switches the tab or the
 * theme leaves `?tab=report&theme=modernist` on the document, and the NEXT `render(<App/>)` in
 * the same file boots from it as a deep link. Measured when the writer first landed: four tests
 * in `App.test.tsx` and one in `Kpis.test.tsx` failed, every one of them asserting a default
 * that an earlier test in its own file had just encoded into the URL.
 *
 * It is exactly the localStorage leak every suite already clears in its own `afterEach`
 * (ruling 6), and it is centralised rather than copied into eighteen files for the reason the
 * rest of this codebase gives: every piece of shared state has exactly one owner. Copying three
 * lines into each suite would leave the next suite someone writes without them, and the failure
 * mode is a test that passes against the wrong state.
 *
 * `globals` stays OFF (see vite.config.ts): `afterEach` is imported explicitly here, so
 * Testing Library's auto-cleanup still does not register and every suite keeps calling
 * `cleanup()` itself.
 *
 * Nothing else belongs in this file. Theme, language and the rest stay with the suites that
 * set them — this is the one piece of state no suite can see it is carrying.
 */

import { afterEach } from 'vitest';

afterEach(() => {
  // The node-environment suites (data, colour and geometry maths) have no document at all.
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    /* a jsdom without a session history is still a usable jsdom for everything else */
  }
});
