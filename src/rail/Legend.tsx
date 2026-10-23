/* Rail group 10 - the two ramp legends. Markup from prototype lines 337-351.
 *
 * FILL TOKENS, NOT INK. Each `.ramp` is five `<i>`s whose `background` is a `--hot-*` /
 * `--cold-*` value. A swatch IS the colour; the -ink scale exists only for ramp colours used as
 * TEXT (spec §3 / §5.4), where `--hot-4` at 19px fails WCAG against `--ui-panel-2`. Putting ink
 * values in a swatch would repaint the legend in colours the map does not use, which is worse
 * than a contrast failure: the key would stop keying anything. Legend.test.tsx pins this, and
 * the test's name says why, because "make the legend match the KPI figures" is a
 * plausible-sounding refactor that would break it.
 *
 * SPEC §6.3 - THE LABELS NAME THE VARIABLE IN PLAIN LANGUAGE. The original read
 * "Hot spots — SUHI °C", which was honest about ITS encoding: it coloured by `suhii`. Spec §3
 * replaces that with `lst_rel` - a spot's `mean_lst` minus its own city's L50 mean for the same
 * period - because `suhii`'s sign agrees with the hot/cold class only 53.5% of the time against
 * `lst_rel`'s 86.3%. §6.3 then requires the legend say what the colour means in words a reader
 * has, "warmer or cooler than the rest of this city", and explicitly NOT the field name. So the
 * copy changes with the encoding. This is a CONTENT change inside an existing selector: the
 * markup, the classes and the inline styles are untouched, so the guard still compares these
 * boxes and still has to match.
 *
 * The tail of each label is literal English in the original too - only the leading
 * "Hot spots" / "Cold spots" span carries `data-i18n` - so the new phrase stays English in all
 * four languages exactly as "— SUHI °C" did. Translating it would need four new dictionary
 * entries, and src/i18n is outside this task.
 *
 * THE TICK NUMBERS ARE STILL THE ORIGINAL'S. `+0.0 / +1.8 / +3.7` and `−0.0 / −0.8 / −1.6` are
 * `suhii` quantiles, and spec §6.2 specifies a different domain for `lst_rel`: one continuous
 * diverging scale clamped at ±4.5 °C. **Task 6 owns that**, because the numbers have to come
 * from the same `encodeValue` that colours the polygons - a legend whose ticks and whose map
 * disagree is worse than one that is merely out of date. When §6.2's domain lands these become
 * +0.0 / +2.3 / +4.5 and −0.0 / −2.3 / −4.5. Note the minus signs are U+2212, not hyphens.
 *
 * Both strips keep `.ramp i{flex:1}`, so the five swatches are equal widths - the ramp is a
 * KEY to the colours, not a histogram of how many spots fall in each band.
 */

import { useT } from '../app/I18nProvider';

/* Exported so the fill-not-ink rule can be asserted on the token list itself. jsdom's CSS
 * parser is unreliable about `background:var(--x)` (it drops the gradient form outright - see
 * the note in Kpis.tsx), so a test that only read `element.style` could pass against `''` and
 * prove nothing. */
export const HOT_RAMP = ['--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5'] as const;
export const COLD_RAMP = ['--cold-1', '--cold-2', '--cold-3', '--cold-4', '--cold-5'] as const;

/** Prototype lines 340 and 345. See the header note on why these are still `suhii` quantiles. */
export const HOT_TICKS = ['+0.0', '+1.8', '+3.7'] as const;
export const COLD_TICKS = ['−0.0', '−0.8', '−1.6'] as const;

function Ramp({ tokens, ticks }: { readonly tokens: readonly string[]; readonly ticks: readonly string[] }) {
  return (
    <>
      <div className="ramp">
        {tokens.map((tok) => (
          <i key={tok} style={{ background: `var(${tok})` }} />
        ))}
      </div>
      <div className="rampL">
        {ticks.map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    </>
  );
}

export function Legend() {
  const t = useT();
  return (
    <div>
      <div className="sec-h" data-i18n="legend">
        {t('legend')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <span data-i18n="hotspots">{t('hotspots')}</span> — warmer than the rest of this city, °C
          </div>
          <Ramp tokens={HOT_RAMP} ticks={HOT_TICKS} />
        </div>
        <div>
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <span data-i18n="coldspots">{t('coldspots')}</span> — cooler than the rest of this city, °C
          </div>
          <Ramp tokens={COLD_RAMP} ticks={COLD_TICKS} />
        </div>
        <p className="note" data-i18n="legend_note">
          {t('legend_note')}
        </p>
      </div>
    </div>
  );
}
