# SUHI App Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard as a Vite/TypeScript application on MapLibre GL, consuming the tokens and data artifacts from plan 1, and deploy it to Cloudflare Pages.

**Architecture:** A static React single-page app with four views behind a tab router. State lives in one framework-agnostic typed store, read through `useSyncExternalStore` and serialised to the URL, so every view is a pure function of it. The map is MapLibre with data-driven style expressions — fill from `encodeValue`, outline from `spot_type`, dash from `bh_significant` — so filter and year changes update paint properties rather than rebuilding layers. Behaviour (focus traps, keyboard, ARIA) comes from **unstyled Radix primitives**; every colour, size and spacing value is a `var(--*)` read from plan 1's stylesheet.

**Tech Stack:** Vite, TypeScript, React 18, Radix UI primitives (Dialog, Tabs, Switch, Slider, Select, Popover, Collapsible), MapLibre GL JS v6, PMTiles, Observable Plot, TanStack Table, Vitest + Testing Library (React), Playwright for the end-to-end checks.

**Why Radix and not shadcn/ui.** shadcn's value is that it supplies a design system; we have one — generated in OKLCH, contrast-audited, with its own bar primitive and map encoding. Adopting shadcn would mean stripping its Tailwind styling to return to what §4–§5 already specify, and the handoff README is explicit that a Tailwind config is where the look starts drifting. We take Radix for behaviour only and write every style ourselves.

**Spec:** `docs/superpowers/specs/2026-10-13-suhi-dashboard-design-system-design.md` (commit `5bc4d1d`, amended for §5.4)

**Depends on:** `docs/superpowers/plans/2026-10-13-suhi-foundations-and-data.md` — every task here assumes `src/styles/suhi-tokens.css`, `src/lib/encode.mjs`, `src/i18n/dictionary.mjs`, `data/cities.json`, `data/clusters.json` and `data/spots.topo.json` already exist and are green.

## Global Constraints

- **Every colour, space, radius, rule and type value is a `var(--*)` read.** No hex literal, no px literal that a token already carries, anywhere in application code. Do not port tokens into a TS theme object or a Tailwind config.
- **No Tailwind, no CSS-in-JS, no component library styling.** Radix is taken unstyled; every Radix part is styled with a plain CSS class reading our tokens. If a Radix component ships a default appearance, override it rather than inherit it.
- Components are function components in `.tsx`. Each view file exports one default component; shared pieces live in `src/components/`.
- Theme is `data-theme` on `<html>`; density is `data-density`. Switching either changes brightness or spacing only — never layout, never a remount.
- Contrast floor **4.5:1** text, **3:1** large text, in both grounds.
- Type floor **11px**; 12px for anything a non-expert must read.
- Counts, areas and populations aggregate **L50 only**.
- `encodeValue` from plan 1 is the **only** function that decides what colour means. No component reads `suhii`, `mean_lst` or `lst_rel` to pick a colour.
- Proportional circles use **one shared sqrt scale** across hot and cold.
- Bar fills use the track-anchored gradient **and the 2px end cap** (§5.4). A bar without a cap is a bug.
- Every bar chart scales to the **selected set**, never the national maximum.
- Tile and basemap attribution strings are required by the terms of use — keep them.
- Commit after every task.

## Testing conventions

Applies to every test snippet below, so they are not repeated per task.

- `render` is from `@testing-library/react`; `screen` and `userEvent` likewise.
- `withStore(store)` is a wrapper helper at `src/test/withStore.tsx` returning `({ children }) => <StoreProvider store={store}>{children}</StoreProvider>`. Write it in Task 2.
- **`root` in a snippet means the `container` returned by `render()`** — `const { container: root } = render(...)`. Prefer `screen` role queries where a role exists; `root.querySelector` is only for the structural assertions that have no accessible role.
- `CITIES`, `CLUSTERS` and `fc` are loaded from `data/` in `src/test/fixtures.ts`.
- MapLibre is stubbed in jsdom by `src/test/mockMap.ts`; the map's real rendering is covered by Playwright in Task 12, not by unit tests.

## Review Focus

Five conditions the spec implies but no feature task would naturally exercise. Each has its test pinned to the owning task.

1. **A spot whose `encodeValue` is `null`** (2 exist, plus any city/period lacking an L50 reference) must render in `--neutral-mid` with its class outline intact, not disappear and not throw. → Task 4.
2. **A city with zero hot spots** (10 have `pop_hot === 0`, 9 have `cold === 0`) must render a zero-length bar with its end cap, not an absent row, and must not divide by zero when scaling to the selected set. → Task 7.
3. **A deep link carrying an unknown city, contour level or language** must fall back to defaults and still render, rather than throwing on load from a stale URL in someone's memo. → Task 3.
4. **The basemap failing to load** must leave polygons, boundaries and every metric fully readable, with a quiet notice. → Task 5.
5. **Switching theme or density** must not remount the map or lose scope, zoom or drawer state. → Task 2.

---

### Task 1: Project scaffold and token wiring

**Files:**
- Create: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/app.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `src/styles/suhi-tokens.css` (plan 1).
- Produces: `<App />` (default export of `src/App.tsx`), a dev server on `npm run dev`, and a static build in `dist/`.

- [ ] **Step 1: Write the failing test**

```ts
it('applies the token stylesheet and defaults to nocturne at default density', () => {
  render(<App />);
  expect(document.documentElement.dataset.theme).toBe('nocturne');
  expect(document.documentElement.dataset.density).toBe('default');
  expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
    .toBe('#35c07d');
});

it('resolves --space-4 to 16px at default and 13.6px at compact', () => {
  render(<App />);
  const read = () => getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim();
  expect(read()).toBe('16px');
  document.documentElement.dataset.density = 'compact';
  expect(parseFloat(read())).toBeCloseTo(13.6, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./App`.

- [ ] **Step 3: Scaffold Vite + React + TypeScript and implement `App` in `src/App.tsx`**

`src/main.tsx` mounts `<App />` with `createRoot`. `index.html` imports `src/styles/suhi-tokens.css` and loads Archivo from Google Fonts with the weights in spec §4.1. `vite.config.ts` sets `base: './'` and `publicDir` so `data/` is copied into `dist/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run build`
Expected: PASS; `dist/` contains the data files.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts tsconfig.json index.html src/main.tsx src/App.tsx src/app.css src/App.test.tsx package.json
git commit -m "feat: scaffold Vite React app wired to the design tokens"
```

---

### Task 2: State store, theme, density and i18n

**Files:**
- Create: `src/state/store.ts`, `src/state/preferences.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `D`, `LANGS`, `T` from `src/i18n/dictionary.mjs` (plan 1).
- Produces: `type AppState = { view: 'map'|'compare'|'table'|'report'; city: string|null; contour: 'all'|'L50'|'L75'|'L90'; cluster: string; year: number; theme: 'nocturne'|'modernist'; lang: 'en'|'ha'|'ig'|'yo'; density: 'compact'|'default'|'touch'; basemap: string; divider: number; opacity: number; layers: Record<string, boolean> }`; `createStore(initial?: Partial<AppState>) -> Store` with `get()`, `set(patch)`, `subscribe(fn) -> unsub`; `DEFAULTS: AppState`; `StoreProvider({ store, children })` and `useAppState() -> [AppState, (patch: Partial<AppState>) => void]`, the hook built on `useSyncExternalStore` so a theme or density change re-renders without remounting the map.

`theme`, `lang` and `density` persist to `localStorage` under `suhi.theme`, `suhi.lang`, `suhi.density`. Everything else is URL state (Task 3).

- [ ] **Step 1: Write the failing tests**

```ts
it('notifies subscribers once per set, with the merged state', () => {
  const s = createStore(); const seen: AppState[] = [];
  s.subscribe(st => seen.push(st));
  s.set({ city: 'Ibadan' });
  expect(seen).toHaveLength(1);
  expect(seen[0].city).toBe('Ibadan');
  expect(seen[0].contour).toBe(DEFAULTS.contour);
});

it('persists only theme, lang and density', () => {
  const s = createStore();
  s.set({ theme: 'modernist', city: 'Kano' });
  expect(localStorage.getItem('suhi.theme')).toBe('modernist');
  expect(localStorage.getItem('suhi.city')).toBeNull();
});

// Review Focus 5 — theme and density must not disturb scope
it('leaves every other field untouched when theme or density changes', () => {
  const s = createStore({ city: 'Ibadan', year: 2019, divider: 0.3 });
  s.set({ theme: 'modernist' }); s.set({ density: 'touch' });
  const st = s.get();
  expect([st.city, st.year, st.divider]).toEqual(['Ibadan', 2019, 0.3]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `store.ts`.

- [ ] **Step 3: Implement the store in `src/state/store.ts` and persistence in `src/state/preferences.ts`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/
git commit -m "feat: add typed app state store with persisted preferences"
```

---

### Task 3: URL state and deep links

**Files:**
- Create: `src/state/url.ts`
- Test: `src/state/url.test.ts`

**Interfaces:**
- Consumes: `AppState`, `DEFAULTS` from Task 2.
- Produces: `stateToSearch(state: AppState) -> string` (omits any field equal to its default), `searchToState(search: string) -> Partial<AppState>` (drops unknown keys and invalid values), `bindUrl(store: Store) -> void`.

Implements spec §8.4. This is what makes a screenshot in a memo reproducible.

- [ ] **Step 1: Write the failing tests**

```ts
it('round-trips a drilled-in view', () => {
  const st = { ...DEFAULTS, city: 'Ibadan', contour: 'L90', year: 2019, lang: 'yo' } as AppState;
  expect(searchToState(stateToSearch(st))).toMatchObject(
    { city: 'Ibadan', contour: 'L90', year: 2019, lang: 'yo' });
});

it('omits defaults from the query string', () => {
  expect(stateToSearch(DEFAULTS)).toBe('');
});

// Review Focus 3 — a stale or hand-edited URL must not throw
it.each([
  '?city=Atlantis', '?contour=L99', '?lang=fr', '?year=1850',
  '?year=notanumber', '?divider=5', '?unknown=1',
])('falls back to defaults for %s', (search) => {
  const partial = searchToState(search);
  const merged = { ...DEFAULTS, ...partial };
  expect(merged.contour).toMatch(/^(all|L50|L75|L90)$/);
  expect(LANGS).toContain(merged.lang);
  expect(merged.year).toBeGreaterThanOrEqual(2015);
  expect(merged.year).toBeLessThanOrEqual(2024);
  expect(merged.divider).toBeGreaterThan(0);
  expect(merged.divider).toBeLessThan(1);
});
```

`searchToState` validates `city` against the 55 names in `cities.json`; anything else is dropped.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `url.ts`.

- [ ] **Step 3: Implement the three functions in `src/state/url.ts`**

`bindUrl` subscribes to the store, writes with `history.replaceState`, and reads on `popstate`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/url.ts src/state/url.test.ts
git commit -m "feat: encode view state in the URL with validated fallbacks"
```

---

### Task 4: Map layers and the spot encoding

**Files:**
- Create: `src/map/style.ts`, `src/map/spots.ts`
- Test: `src/map/style.test.ts`

**Interfaces:**
- Consumes: `encodeValue`, `buildReferenceMeans`, `ENCODE_DOMAIN` from `src/lib/encode.mjs` (plan 1).
- Produces: `spotFillExpression(domain: [number, number]) -> maplibregl.ExpressionSpecification` — an `interpolate` over the feature's `lst_rel` across the eleven diverging stops; `spotLineExpression() -> ExpressionSpecification` (warm stroke for `spot_type === 'hot'`, cool for `'cold'`); `spotDashExpression() -> ExpressionSpecification`; `attachLstRel(fc, refs) -> FeatureCollection` writing `lst_rel` into each feature's properties.

Spec §6.2, §6.3. Panes become MapLibre layer order: basemap, boundaries, day spots, night spots, city circles, city labels.

- [ ] **Step 1: Write the failing tests**

```ts
it('maps the domain ends and the midpoint to the right ramp stops', () => {
  const e = spotFillExpression([-4.5, 4.5]);
  expect(stopFor(e, -4.5)).toBe('var(--cold-5)');
  expect(stopFor(e, 0)).toBe('var(--neutral-mid)');
  expect(stopFor(e, 4.5)).toBe('var(--hot-5)');
});

it('clamps beyond the domain rather than extrapolating', () => {
  expect(stopFor(spotFillExpression([-4.5, 4.5]), -9)).toBe('var(--cold-5)');
});

it('carries class in the outline, never the fill', () => {
  const line = JSON.stringify(spotLineExpression());
  expect(line).toContain('spot_type');
  expect(JSON.stringify(spotFillExpression([-4.5, 4.5]))).not.toContain('spot_type');
});

it('dashes only the spots that failed BH correction', () => {
  expect(JSON.stringify(spotDashExpression())).toContain('bh_significant');
});

// Review Focus 1 — null lst_rel
it('renders a null-encoded spot as neutral with its outline intact', () => {
  const fcOut = attachLstRel(fc, buildReferenceMeans(fc.features));
  const nulls = fcOut.features.filter(f => f.properties.lst_rel === null);
  expect(nulls.length).toBeGreaterThan(0);
  for (const f of nulls) {
    expect(stopFor(spotFillExpression([-4.5, 4.5]), f.properties.lst_rel))
      .toBe('var(--neutral-mid)');
    expect(f.properties.spot_type).toBeDefined();
  }
});
```

`stopFor(expression, value)` is a test helper in `src/map/style.test.ts` that evaluates a MapLibre `interpolate` expression against a value — write it alongside the tests.

**Two implementation notes carried from plan 1's Task 6 review:**

- **`interpolate` does not handle `null`.** Wrap it: `['case', ['==', ['get','lst_rel'], null], <--neutral-mid>, ['interpolate', ['linear'], ['get','lst_rel'], -4.5, …, 0, …, 4.5, …]]`. This is not hypothetical — `Bida|night` has no reference mean (its only L50 night spots carry `mean_lst: null`), so 2 of 441 features encode to `null` on the real data today.
- **`buildReferenceMeans` must be called on the UNFILTERED feature set.** It derives each city/period mean from that set, so calling it after a city, level or cluster filter silently changes every colour on screen. Build the refs once at load, write `lst_rel` onto each feature's properties with `attachLstRel`, then filter.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `style.ts`.

- [ ] **Step 3: Implement the four functions**

Token values reach MapLibre by reading the computed custom properties once per theme change and substituting them into the expression — the expression is rebuilt on theme change, not hard-coded.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/map/
git commit -m "feat: encode spots as a diverging fill with class in the outline"
```

---

### Task 5: Map view — basemap, wipe, circles, drawer

**Files:**
- Create: `src/views/MapView.tsx`, `src/map/basemap.ts`, `src/map/circles.ts`, `src/views/Drawer.tsx`
- Test: `src/views/MapView.test.tsx`, `src/map/circles.test.ts`

**Interfaces:**
- Consumes: Task 4's expressions; `createStore` from Task 2.
- Produces: `<MapView />` (reads the store through `useAppState`); `circleRadius(cities: City[], metric: 'pop'|'area') -> (value: number) => number` — one shared `scaleSqrt` across hot and cold with range `[3, 22]`; `setBasemap(map, key: string) -> Promise<void>`.

Carries forward spec §9.1 items 6 and 10: the state-boundary placeholder is **clipped to Nigeria's outline**, not drawn to the bounding box; city circles sit **above** the spot layers.

- [ ] **Step 1: Write the failing tests**

```ts
it('uses one sqrt scale for hot and cold so equal area means equal population', () => {
  const r = circleRadius(CITIES, 'pop');
  const [a, b] = [CITIES[0], CITIES[1]];
  expect(r(a.pop_hot) / r(a.pop_cold)).toBeCloseTo(Math.sqrt(a.pop_hot / a.pop_cold), 5);
  expect(r(b.pop_hot)).toBe(r(b.pop_hot));   // same value, same radius, either family
});

it('orders layers with circles above spots and labels above circles', () => {
  const order = layerOrder();
  expect(order.indexOf('city-circles')).toBeGreaterThan(order.indexOf('spots-night'));
  expect(order.indexOf('city-labels')).toBeGreaterThan(order.indexOf('city-circles'));
});

it('clips the state-boundary placeholder to the national outline', () => {
  for (const [lon, lat] of placeholderBoundaryCoords()) {
    expect(booleanPointInPolygon([lon, lat], NIGERIA)).toBe(true);
  }
});

// Review Focus 4 — basemap failure
it('keeps spots, boundaries and metrics readable when the basemap fails', async () => {
  const { map, notice } = await mountWithFailingTiles();
  expect(map.getLayer('spots-day')).toBeDefined();
  expect(map.getLayer('national-boundary')).toBeDefined();
  expect(notice.textContent).toMatch(/basemap/i);
});
```

`mountWithFailingTiles()` is a test helper that renders `<MapView />` with the basemap source URL pointed at a 404 and returns `{ map, notice }` — write it beside the test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the map view**

The map instance is created once in a `useEffect` with an empty dependency array and held in a ref, so no state change remounts it. The day/night wipe clips the two spot layers by updating paint bounds as the divider moves; the divider is a Radix `Slider`, which gives arrow-key operation at 5% per press. The drawer is a Radix `Dialog` in non-modal mode, supplying the focus trap, the restore on close and Escape-to-close.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/views/MapView.tsx src/views/Drawer.tsx src/map/basemap.ts src/map/circles.ts src/views/MapView.test.tsx src/map/circles.test.ts
git commit -m "feat: add map view with wipe, proportional circles and drawer"
```

---

### Task 6: Header, rail and the headline sentence

**Files:**
- Create: `src/views/Header.tsx`, `src/views/Rail.tsx`, `src/views/Headline.tsx`
- Test: `src/views/Header.test.tsx`, `src/views/Rail.test.tsx`, `src/views/Headline.test.tsx`

**Interfaces:**
- Consumes: `createStore`, `T`.
- Produces: `<Header />`, `<Rail />`, and `headlineText(scope: Scope, lang: Lang) -> { kicker: string; sentence: string; detail: string }`.

Spec §7.2, §7.3, §7.1. Carries forward §9.1 items 2, 3 and 7: toggles are `role="switch"` with `aria-checked` bound to store state (never hardcoded), and every KPI tile has a value.

- [ ] **Step 1: Write the failing tests**

```ts
it('has four one-word tabs and no Export button', () => {
  render(<Header />, { wrapper: withStore(createStore()) });
  expect([...root.querySelectorAll('[role=tab]')].map(t => t.textContent))
    .toEqual(['Map', 'Compare', 'Table', 'Report']);
  expect(root.querySelector('[data-action=export]')).toBeNull();
});

// §9.1 item 2 — toggles must read store state, not a hardcoded attribute
it('keeps layer toggles in sync with state across a language change', () => {
  const store = createStore(); render(<Rail />, { wrapper: withStore(store) });
  const toggle = root.querySelector('[role=switch][data-layer=cities]')!;
  (toggle as HTMLElement).click();
  expect(store.get().layers.cities).toBe(false);
  store.set({ lang: 'ha' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
});

it('exposes every toggle to the keyboard', () => {
  render(<Rail />, { wrapper: withStore(createStore()) });
  for (const el of root.querySelectorAll('[role=switch]')) {
    expect(el.getAttribute('tabindex') ?? (el as HTMLElement).tabIndex).not.toBe(-1);
    expect(el).toHaveAttribute('aria-checked');
  }
});

it('opens Scope and collapses Display and Explain', () => {
  render(<Rail />, { wrapper: withStore(createStore()) });
  expect(group('scope').getAttribute('aria-expanded')).toBe('true');
  expect(group('display').getAttribute('aria-expanded')).toBe('false');
  expect(group('explain').getAttribute('aria-expanded')).toBe('false');
});

it('rewrites the headline on scope change in every language', () => {
  for (const lang of LANGS) {
    expect(headlineText({ kind: 'national' }, lang).sentence).toContain('137,470');
    expect(headlineText({ kind: 'city', city: 'Ibadan' }, lang).sentence).toContain('Ibadan');
  }
});

it('announces scope changes to screen readers', () => {
  render(<Rail />, { wrapper: withStore(createStore()) });
  expect(root.querySelector('[aria-live=polite]')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement header, rail and headline**

Radix supplies the behaviour: `Tabs` for the tab list, `Switch` for every layer toggle (it provides `role="switch"`, `aria-checked` and keyboard operation), `Collapsible` for the three rail groups, `Select` for language, theme, density and cluster, and `Slider` for year and opacity. Each is styled from scratch against our tokens. `Framed` lives in the Display group.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/views/Header.tsx src/views/Rail.tsx src/views/Headline.tsx src/views/*.test.tsx
git commit -m "feat: add header, disclosure rail and headline sentence"
```

---

### Task 7: Bar primitive and the Compare matrix

**Files:**
- Create: `src/components/Bar.tsx`, `src/views/CompareView.tsx`
- Test: `src/components/Bar.test.tsx`, `src/views/CompareView.test.tsx`

**Interfaces:**
- Consumes: `createStore`, `T`.
- Produces: `<Bar value={number} max={number} family="hot" | "cold" />` — a track plus a fill whose `background-size` is `calc(100% * max/value)` and which always carries the end cap; `compareScale(cities: City[], key: keyof City) -> number` returning the **selected set's** maximum.

Spec §5.4, §7.5.1, §7.5.2. This is the single bar primitive; every bar in the app uses it.

- [ ] **Step 1: Write the failing tests**

```ts
it('anchors the gradient to the track, not the bar', () => {
  const half = render(<Bar value={50} max={100} family="hot" />).querySelector('.bar-fill')!;
  expect(getComputedStyle(half).backgroundSize.split(' ')[0]).toBe('200%');
  const full = render(<Bar value={100} max={100} family="hot" />).querySelector('.bar-fill')!;
  expect(getComputedStyle(full).backgroundSize.split(' ')[0]).toBe('100%');
});

it('always draws the end cap', () => {
  for (const v of [0, 1, 50, 100]) {
    const fill = render(<Bar value={v} max={100} family="hot" />).querySelector('.bar-fill')!;
    expect(parseFloat(getComputedStyle(fill).borderRightWidth)).toBeGreaterThan(0);
  }
});

it('scales to the selected set, not the national maximum', () => {
  const picked = CITIES.filter(c => ['Ibadan', 'Kano'].includes(c.city));
  expect(compareScale(picked, 'pop_hot')).toBe(Math.max(...picked.map(c => c.pop_hot)));
  expect(compareScale(picked, 'pop_hot')).toBeLessThan(
    Math.max(...CITIES.map(c => c.pop_hot)));      // Lagos is excluded
});

// Review Focus 2 — zero-valued and empty-set cases
it('renders a zero bar with its cap and never divides by zero', () => {
  const zero = render(<Bar value={0} max={100} family="hot" />).querySelector('.bar-fill')!;
  expect(zero.clientWidth).toBe(0);
  expect(parseFloat(getComputedStyle(zero).borderRightWidth)).toBeGreaterThan(0);
  expect(() => render(<Bar value={0} max={0} family="cold" />)).not.toThrow();
});

it('shows a row for a city with no cold spots', () => {
  const noCold = CITIES.find(c => c.cold === 0)!;
  render(<CompareView cities={[noCold]} />, { wrapper: withStore(createStore({ })) });
  expect(root.querySelector('[data-measure=pop_cold]')).not.toBeNull();
});

it('caps the picker at four cities', async () => {
  render(<CompareView cities={CITIES.slice(0, 4)} />, { wrapper: withStore(createStore()) });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(CITIES[4].city) }));
  expect(screen.getAllByRole('columnheader')).toHaveLength(5);   // 4 cities + the measure column
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the bar primitive and the matrix**

Matrix is measures down, cities across, with search-to-add chips.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Bar.tsx src/views/CompareView.tsx src/components/Bar.test.tsx src/views/CompareView.test.tsx
git commit -m "feat: add track-anchored bar primitive and compare matrix"
```

---

### Task 8: Compare charts

**Files:**
- Create: `src/charts/dayNight.ts`, `src/charts/contourProfile.ts`, `src/charts/concentration.ts`
- Test: `src/charts/charts.test.ts`

**Interfaces:**
- Consumes: `renderBar` from Task 7.
- Produces: `dayNightSeries(spots) -> { city: string; day: number; night: number; change: number }[]` sorted by `change` descending; `contourProfileSeries(spots) -> { level: 'L50'|'L75'|'L90'; suhii: number; area: number }[]`; `concentrationSeries(cities) -> { city: string; share: number; cumulative: number }[]`.

Spec §7.5.3. All three render as clustered bars; none uses a time axis.

- [ ] **Step 1: Write the failing tests**

```ts
it('derives day/night pairs only for cities having both, from L50 hot spots', () => {
  const s = dayNightSeries(fc.features);
  expect(s).toHaveLength(30);
  expect(s[0].city).toBe('Maiduguri');            // largest positive change
  expect(s[0].day).toBeCloseTo(-1.50, 2);
  expect(s[0].night).toBeCloseTo(0.89, 2);
  expect(s.at(-1)!.city).toBe('Akure');
});

it('counts the cities that get hotter after dark', () => {
  expect(dayNightSeries(fc.features).filter(d => d.change > 0)).toHaveLength(8);
});

it('shows area collapsing while intensity rises', () => {
  const p = contourProfileSeries(fc.features);
  expect(p.map(x => x.level)).toEqual(['L50', 'L75', 'L90']);
  expect(p[0].area).toBeGreaterThan(p[2].area * 4);
  expect(p[2].suhii).toBeGreaterThan(p[0].suhii);
});

it('reproduces the published concentration figures', () => {
  const c = concentrationSeries(CITIES);
  expect(c[0].cumulative).toBeCloseTo(22.3, 1);
  expect(c[4].cumulative).toBeCloseTo(58.5, 1);
  expect(c[9].cumulative).toBeCloseTo(75.3, 1);
  expect(c[19].cumulative).toBeCloseTo(93.2, 1);
});

it('uses no time axis in any chart', () => {
  for (const spec of [dayNightSpec(), contourProfileSpec(), concentrationSpec()]) {
    expect(JSON.stringify(spec)).not.toMatch(/\byear\b/);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three series functions and their renderers**

Day/night bars are horizontal with a zero line and a shaded "cooler than rural" region left of zero; the other two are vertical clustered.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/charts/
git commit -m "feat: add day/night, contour profile and concentration charts"
```

---

### Task 9: Data table

**Files:**
- Create: `src/views/TableView.tsx`
- Test: `src/views/TableView.test.tsx`

**Interfaces:**
- Consumes: `createStore`, `T`.
- Produces: `<TableView />`; `DEFAULT_COLUMNS: (keyof City)[]` = `['city','hot','cold','pop_hot','suhii','pct_hot','slope']`; `ALL_COLUMNS: (keyof City)[]` (17).

Spec §7.6.

- [ ] **Step 1: Write the failing tests**

```ts
it('shows seven columns by default and seventeen when expanded', () => {
  render(<TableView />, { wrapper: withStore(createStore()) });
  expect(root.querySelectorAll('thead th')).toHaveLength(7);
  root.querySelector<HTMLElement>('[data-action=show-all-fields]')!.click();
  expect(root.querySelectorAll('thead th')).toHaveLength(17);
});

it('sorts by population in hot spots, descending, by default', () => {
  render(<TableView />, { wrapper: withStore(createStore()) });
  expect(firstCell(root)).toBe('Lagos');
});

it('keeps the city column and the header sticky', () => {
  render(<TableView />, { wrapper: withStore(createStore()) });
  expect(getComputedStyle(root.querySelector('tbody td')!).position).toBe('sticky');
  expect(getComputedStyle(root.querySelector('thead th')!).position).toBe('sticky');
});

it('states in the lede that the ranking changes with the metric', () => {
  render(<TableView />, { wrapper: withStore(createStore()) });
  expect(root.querySelector('.lede')!.textContent).toMatch(/ranking changes/i);
});

it('opens the clicked city on the map', () => {
  const store = createStore(); render(<TableView />, { wrapper: withStore(store) });
  root.querySelector<HTMLElement>('tbody tr')!.click();
  expect(store.get()).toMatchObject({ view: 'map', city: 'Lagos' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the table with `@tanstack/react-table`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/views/TableView.tsx src/views/TableView.test.tsx
git commit -m "feat: add data table with seven default columns and sticky axes"
```

---

### Task 10: Reports, exports and print

**Files:**
- Create: `src/views/ReportView.tsx`, `src/export/writers.ts`, `src/styles/print.css`
- Test: `src/views/ReportView.test.tsx`, `src/export/writers.test.ts`

**Interfaces:**
- Consumes: `createStore`, `T`.
- Produces: `<ReportView />`; `briefProse(city: City, cluster: Cluster, lang: Lang) -> string`; `EXPORT_FORMATS` (6 entries, each `{ id, label, detail, mime, build(state) }`); `toCsv(rows, columns) -> string`; `toGeoJson(features) -> string`.

Spec §7.7, §8.5.

- [ ] **Step 1: Write the failing tests**

```ts
it('disables Download until a format is chosen', () => {
  render(<ReportView />, { wrapper: withStore(createStore()) });
  const btn = root.querySelector<HTMLButtonElement>('[data-action=download]')!;
  expect(btn.disabled).toBe(true);
  selectFormat(root, 'spot-records-csv');
  expect(btn.disabled).toBe(false);
});

it('offers all six formats in one control', () => {
  render(<ReportView />, { wrapper: withStore(createStore()) });
  expect(root.querySelectorAll('select[data-export] option')).toHaveLength(7); // 6 + placeholder
});

it('applies the active contour, cluster and year filters to an export', () => {
  const state = { ...DEFAULTS, contour: 'L90' as const, city: 'Ibadan' };
  const rows = EXPORT_FORMATS.find(f => f.id === 'spot-records-csv')!.build(state);
  expect(rows.every(r => r.contour_level === 'L90' && r.city === 'Ibadan')).toBe(true);
});

it('builds the brief from the city figures, with no placeholder text', () => {
  const prose = briefProse(IBADAN, CLUSTER_9, 'en');
  expect(prose).toContain('+2.34');
  expect(prose).toContain('15,378');
  expect(prose).not.toMatch(/lorem|TODO|\{\w+\}/i);
});

it('prints the brief alone, on one page, in both grounds', async () => {
  for (const theme of ['nocturne', 'modernist']) {
    const { pages, clipped } = await renderPrint('/report?city=Ibadan', theme);
    expect(pages).toBe(1);
    expect(clipped).toBe(false);
  }
});
```

The print test is Playwright with `emulateMedia({ media: 'print' })`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test && npx playwright test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the report view, the writers and `print.css`**

The export control is a Radix `Select`; the Download button is `disabled` until a format is chosen.

`print.css` hides every element outside the brief and sets A4 page geometry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx playwright test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/ReportView.tsx src/export/ src/styles/print.css src/views/ReportView.test.tsx
git commit -m "feat: add report brief, export control and print stylesheet"
```

---

### Task 11: Themed PMTiles basemap

**Files:**
- Create: `src/map/basemap-style.ts`, `public/basemap/nigeria.pmtiles`
- Modify: `src/map/basemap.ts`
- Test: `src/map/basemap-style.test.ts`

**Interfaces:**
- Consumes: the token stylesheet.
- Produces: `basemapStyle(theme: 'nocturne'|'modernist') -> maplibregl.StyleSpecification` whose every paint colour is read from a custom property.

Spec §8.3. This is what makes the basemap part of the design system rather than a third-party surface underneath it.

- [ ] **Step 1: Write the failing tests**

```ts
it('takes every colour from a token, never a literal', () => {
  const json = JSON.stringify(basemapStyle('nocturne'));
  const literals = json.match(/#[0-9a-fA-F]{6}/g) ?? [];
  expect(literals.filter(h => !TOKEN_VALUES.has(h.toLowerCase()))).toEqual([]);
});

it('produces a different ground per theme from the same structure', () => {
  const [n, m] = [basemapStyle('nocturne'), basemapStyle('modernist')];
  expect(n.layers.map(l => l.id)).toEqual(m.layers.map(l => l.id));
  expect(JSON.stringify(n)).not.toBe(JSON.stringify(m));
});

it('keeps the required attribution', () => {
  expect(JSON.stringify(basemapStyle('nocturne'))).toMatch(/OpenStreetMap/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Extract a Nigeria PMTiles archive and implement `basemapStyle`**

Extract the Nigeria bounding box from the Protomaps world build with `pmtiles extract`, and vendor the glyph PBFs the style needs.

- [ ] **Step 4: Run tests and look at both themes**

Run: `npm test && npm run dev`
Expected: PASS; the basemap re-skins with `data-theme` and the archive is under 50 MB.

- [ ] **Step 5: Commit**

```bash
git add src/map/basemap-style.ts src/map/basemap.ts public/basemap/ src/map/basemap-style.test.ts
git commit -m "feat: self-host a themed PMTiles basemap"
```

---

### Task 12: Mobile, reduced motion and deployment

**Files:**
- Create: `wrangler.toml`, `.github/workflows/ci.yml`
- Modify: `src/app.css`, `README.md`
- Test: `e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: a Cloudflare Pages deployment and a CI workflow running `npm test`, `npm run audit`, `npm run derive -- --check` and Playwright.

Spec §7.8, §8.6; closes §9.1 item 8.

- [ ] **Step 1: Write the failing tests**

```ts
it('is usable at 390x844 with 44px hit targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-headline]')).toBeVisible();
  for (const el of await page.locator('[role=switch], button').all()) {
    const box = await el.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

it('honours prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() =>
    getComputedStyle(document.querySelector('.drawer')!).transitionDuration)).toBe('0s');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test`
Expected: FAIL.

- [ ] **Step 3: Implement the bottom sheet, the reduced-motion block and the deployment config**

At `touch` density the rail becomes a bottom sheet; the Compare matrix scrolls horizontally with a sticky measure column. `README.md` records the Cloudflare decision.

- [ ] **Step 4: Verify the whole suite and deploy**

Run: `npm test && npm run audit && npx playwright test && npm run build`
Then deploy and load the live URL cold in a private window: all 441 polygons, no console errors.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml .github/workflows/ci.yml src/app.css README.md e2e/
git commit -m "feat: add mobile layout, reduced motion and Cloudflare deployment"
```

---

## Done when

- `npm test` and `npx playwright test` pass; `npm run audit` exits 0.
- Every §9.1 defect is closed: the toggles are keyboard-operable and stay in sync, no magic divisors remain, the graticule is clipped to Nigeria, circles sit above spots, every KPI tile has a value, and reduced motion, print and responsive styles all exist.
- A URL copied after drilling into Ibadan at L90 reopens exactly that view; a corrupted one still loads.
- Blocking the basemap leaves every polygon and metric readable.
- The live Cloudflare URL renders cold in a private window with no console errors.

## Not in this plan

- Spec §10.1 (Gi\* z-score) — arrives as a change to `encodeValue`'s body and the legend string, nothing else.
- Spec §10.2 — city-total population, real admin boundaries, native language review. All blocked on inputs from outside the repository.
- Draw-to-select, saved views, logins, a backend.
