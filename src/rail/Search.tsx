/* Rail group 1 - the city search. Markup from prototype lines 272-275, behaviour from the
 * `#search` oninput handler, lines 996-1005.
 *
 * RULING 23: the match is `c.city.toLowerCase().includes(q)` and nothing more. No diacritic
 * folding, no spot-ID matching, no fuzzy scoring. The placeholder says "Search city or spot
 * ID…" and the handler only ever searched CITIES, which is a copy bug in the original, not a
 * missing feature here: adding spot IDs would change what the reader can find. All 55 city
 * names are ASCII (asserted in Search.test.tsx), so folding would also be untestable against
 * this data - it would be an improvement with no evidence behind it.
 *
 * The `.slice(0, 6)` cap and the em-dash empty state (a `.note` with inline padding:4px 7px)
 * are the original's, down to the padding.
 */

import { useState } from 'react';
import { useT } from '../app/I18nProvider';
import type { City } from '../app/data';

export interface SearchProps {
  readonly cities: readonly City[];
  /** `focusCity` (prototype line 818): sets state.city, then fits the map and opens the city
   * drawer. Setting the city is the caller's job; the map half is Task 6-7's seam. */
  readonly onPickCity: (city: string) => void;
}

/** Prototype line 999, verbatim. Exported so the test asserts the rule, not a re-derivation. */
export const matchCities = (cities: readonly City[], query: string): City[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return cities.filter((c) => c.city.toLowerCase().includes(q)).slice(0, 6);
};

export function Search({ cities, onPickCity }: SearchProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hits = matchCities(cities, query);

  return (
    <div>
      <input
        className="search"
        id="search"
        data-i18n-ph="search_ph"
        placeholder={t('search_ph')}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* `#results` is always in the DOM and merely EMPTIED when the query is blank - the
       * original assigned innerHTML='' rather than hiding the container, and `.rowlist`'s
       * 6px top margin is an inline style on it, not a CSS rule. */}
      <div id="results" className="rowlist" style={{ marginTop: '6px' }}>
        {q === '' ? null : hits.length > 0 ? (
          hits.map((c) => (
            <div
              className="rw"
              key={c.city}
              data-c={c.city}
              onClick={() => {
                setQuery('');
                onPickCity(c.city);
              }}
            >
              <span>{c.city}</span>
              {/* Always a leading '+', whatever the sign - the original's own template. */}
              <span className="n">+{c.suhii}°</span>
            </div>
          ))
        ) : (
          <div className="note" style={{ padding: '4px 7px' }}>
            —
          </div>
        )}
      </div>
    </div>
  );
}
