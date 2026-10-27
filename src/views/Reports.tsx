/* The Reports tab. `renderReport()`, prototype lines 1132-1169, transcribed — with §7.7's one
 * sanctioned change and §9.1 bug 11's fix.
 *
 * RULING 20, AND THE ONE PIXEL THAT DECIDES IT. The brief's four-column figure grid is
 * `font-size: 23px` at `--font-heading-weight`, on `--ui-panel-2`. WCAG's "large text" floor of
 * 3.0:1 starts at 24px for any weight, or at 18.66px for weight >= 700 — so 23px lands ONE
 * PIXEL below the any-weight threshold and the weight token alone decides which floor applies.
 * The two themes then land on opposite sides of it: Nocturne's `--font-heading-weight` is 500,
 * which makes these figures BODY TEXT at 4.5:1, where `--hot-4` (4.25), `--cold-4` (2.49) and
 * `--hot-5` (2.75) all fail; Modernist's is 800, which makes them large text at 3.0:1, where
 * all three pass. A colour that is only legible in one theme is not a colour this page can use,
 * so the three fills become their ink siblings (§5.4) — `--hot-4-ink`, `--cold-4-ink`,
 * `--hot-5-ink`, each clearing 4.5:1 on `--ui-panel-2` in BOTH themes. The 23px and the weight
 * token are reproduced exactly; only the colour moves. Do not round 23 up to 24 to "fix" the
 * contrast: that changes the approved page's type scale, and the ink tokens already fix it.
 *
 * §9.1 BUG 11. The original writes a BARE `+` before `suhii` in the prose (line 1161), so the
 * 18 cities with a negative SUHI intensity read `+-0.66 °C`. The slope in the very next
 * sentence (line 1164) gets the conditional the intensity should have had. Both go through
 * `signed` here. The default city is Ibadan, whose +2.34 is positive, so this changes no pixel
 * on a freshly loaded page — the fidelity guard is silent and no ALLOWED_DIFFS entry is needed;
 * it changes the 18 cities a reader can select.
 *
 * SPEC §7.7's ONE CHANGE, requested by the user directly: the six `.card2` cards inside
 * `.expgrid` become one `select` plus a Download button that appears only after a format is
 * chosen. The `.expgrid` container, its class, its id and its column position are unchanged,
 * and so are the six labels and descriptions — verbatim from lines 1157-1163, in
 * EXPORT_OPTIONS. The select is a NATIVE `<select className="mini-sel">` for the reason
 * App.tsx's PICKERS note gives at length: a Radix Select renders a button trigger plus a
 * portalled listbox, app.css has no rules for a portalled popup, and `.mini-sel` is written
 * for a native control (appearance:none plus two gradients drawing the chevron).
 *
 * THE EXPORT ITSELF IS RULING 40's — see the long note at the top of src/lib/export.ts. Nothing
 * about it is transcription: the original's six Download buttons have no handler at all.
 */

import { useState } from 'react';
import { useT } from '../app/I18nProvider';
import { useAppState } from '../app/state';
import type { City, SuhiData } from '../app/data';
import { fmt } from '../rail/stats';
import {
  EXPORT_BY_VALUE,
  EXPORT_OPTIONS,
  buildExport,
  filtersFrom,
  saveBlob,
  type ExportFormat,
} from '../lib/export';

/** §9.1 bug 11's convention: a sign TEST, never a bare `+`. Local copies live in Drawer.tsx and
 * Tooltip.tsx; three identical four-line helpers is one too many and consolidating them is a
 * cleanup for a later task, not a change to make from inside this one. */
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Prototype line 1133: the brief is for the scoped city, or Ibadan, or the first row. */
export function briefCity(cities: readonly City[], city: string | null): City | undefined {
  return cities.find((x) => x.city === (city || 'Ibadan')) ?? cities[0];
}

export interface ReportsProps {
  readonly data: SuhiData | null;
  /** Test/composition seams. The defaults are the real implementations; the suite injects spies
   * so it never needs `URL.createObjectURL` or `window.print`, neither of which jsdom has. */
  readonly onPrint?: () => void;
  readonly onSave?: (blob: Blob, filename: string) => void;
  /** Seeds the select, for the suite and for a future deep link (Task 11's, not this one's). */
  readonly initialFormat?: ExportFormat | '';
}

export function Reports({ data, onPrint, onSave, initialFormat = '' }: ReportsProps) {
  const t = useT();
  const [state] = useAppState();
  const [format, setFormat] = useState<ExportFormat | ''>(initialFormat);
  const c = data ? briefCity(data.cities, state.city) : undefined;

  const download = () => {
    const opt = format ? EXPORT_BY_VALUE.get(format) : undefined;
    if (!opt || !data) return;
    /* The two PDF options go to the print dialog, whose "Save as PDF" is the deliverable. See
     * src/lib/export.ts for why no PDF library was added, and Task 11 for the stylesheet that
     * makes the printed page a brief rather than a screenshot of a dashboard. */
    if (opt.kind === 'print') {
      (onPrint ?? (() => window.print()))();
      return;
    }
    const blob = buildExport(format as ExportFormat, data, filtersFrom(state));
    if (blob) (onSave ?? saveBlob)(blob, opt.filename ?? 'suhi-export');
  };

  return (
    /* Prototype lines 390-395: the flex row, the 640px brief, and the export column. Inline
     * styles because the original's are inline - app.css has no rule for either wrapper, so a
     * class here would be a new rule the guard would have nothing to compare. */
    <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div className="brief" id="brief">
        {c ? <Brief city={c} typology={typologyOf(data, c)} peers={peersOf(data, c)} /> : null}
      </div>
      <div style={{ flex: 1, minWidth: '260px' }}>
        <div className="sec-h" data-i18n="data_export">
          {t('data_export')}
        </div>
        <div className="expgrid" id="exports">
          {/* SPEC §7.7. One select, and a Download button that is ABSENT - not disabled - until
            * a format is chosen: a disabled button is a control the reader can see and cannot
            * use, and the change was asked for as "the button appears after a format is
            * chosen". The empty option is the placeholder a native select needs to start with
            * no selection. */}
          <select
            className="mini-sel"
            id="exportFormat"
            aria-label={t('data_export')}
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat | '')}
          >
            <option value="">{`${t('data_export')}…`}</option>
            {EXPORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {`${o.label} — ${o.desc}`}
              </option>
            ))}
          </select>
          {format ? (
            <button className="ghost" id="exportGo" data-i18n="download" onClick={download}>
              {t('download')}
            </button>
          ) : null}
        </div>
        <p className="note" style={{ marginTop: '14px' }} data-i18n="export_note">
          {t('export_note')}
        </p>
      </div>
    </div>
  );
}

const typologyOf = (data: SuhiData | null, c: City): string =>
  data?.clusters.find((k) => k.id === c.cluster)?.typology ?? '';

/** Prototype line 1166: `n_cities - 1`, "the other cities in this typology". `|| 1` is the
 * original's own fallback, so a cluster missing from the file reads 0 rather than NaN. */
const peersOf = (data: SuhiData | null, c: City): number =>
  (data?.clusters.find((k) => k.id === c.cluster)?.n_cities || 1) - 1;

/** The four figures: label, value, and the INK token ruling 20 moves each fill to. The fourth
 * has no colour in the original (`''` -> `inherit`), so it keeps none. */
const FIGURES: readonly { readonly tk: string; readonly pct?: true; readonly color?: string }[] = [
  { tk: 'hotspots', color: 'var(--hot-4-ink)' },
  { tk: 'coldspots', color: 'var(--cold-4-ink)' },
  { tk: 'hot', pct: true, color: 'var(--hot-5-ink)' },
  { tk: 'pop_in_hot' },
];

function Brief({ city: c, typology, peers }: { city: City; typology: string; peers: number }) {
  const t = useT();
  const values = [String(c.hot), String(c.cold), `${c.pct_hot}%`, fmt(c.pop_hot)];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h3>{c.city}</h3>
          {/* Line 1137, transcribed including its oddity: `T('composite')` is '2024 composite'
            * and the original drops its FIRST word, so English reads "SUHI · 2024 composite"
            * while Hausa's 'Haɗin 2024' reads "SUHI · 2024 2024". Not corrected here - the
            * string surgery is the approved page's, and the fix belongs in the dictionary. */}
          <div className="note">{`SUHI · 2024 ${t('composite').split(' ').slice(1).join(' ')}`}</div>
        </div>
        <div className="note" style={{ textAlign: 'right' }}>
          SUHI Nigeria
        </div>
      </div>
      <div className="rule"></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {FIGURES.map((f, i) => (
          <div key={f.tk}>
            <div
              style={{
                fontSize: '9px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--ui-muted)',
              }}
            >
              {f.pct ? `% ${t(f.tk)}` : t(f.tk)}
            </div>
            {/* RULING 20 lives in these four lines: 23px and `--font-heading-weight` exactly as
              * the original has them, with the fill tokens swapped for ink. */}
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 'var(--font-heading-weight)',
                fontSize: '23px',
                color: f.color ?? 'inherit',
                letterSpacing: '-.02em',
              }}
            >
              {values[i]}
            </div>
          </div>
        ))}
      </div>
      <div className="rule"></div>
      <p style={{ fontSize: '12.5px', lineHeight: 1.6 }}>
        {/* Lines 1159-1166, one string, so the paragraph wraps exactly as the original's does.
          * `signed(c.suhii)` is §9.1 bug 11: the original's bare `+` here prints `+-0.66 °C`. */}
        {`${c.city} records a mean surface urban heat island intensity of ${signed(c.suhii)} °C against its rural background, ` +
          `with a maximum land surface temperature of ${fmt(c.max_lst, 1)} °C across ${c.hotdays} MODIS hot days. ` +
          `Hot spots cover ${fmt(c.area_hot, 0)} km² — ${c.pct_hot}% of the ${fmt(c.city_area, 0)} km² study extent — and ` +
          `contain ${fmt(c.pop_hot)} people. The Sen slope over the record is ${signed(c.slope)} °C per decade. ` +
          `Dominant landcover inside the contours is ${c.landcover.toLowerCase()}; the terrain is ${c.elev.toLowerCase()} ` +
          `on ${c.geol.toLowerCase()}. It falls in cluster ${c.cluster} — ${typology} — ` +
          `the typology it shares with ${peers} other cities in this study.`}
      </p>
      <div className="rule"></div>
      <div className="note">
        {`${t('method')}: Getis-Ord Gi* on MODIS LST, Benjamini–Hochberg corrected. ` +
          `Contours at L50/L75/L90. ${c.sig} significant after correction.`}
      </div>
    </>
  );
}
