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
 * THE TICK NUMBERS ARE SPEC §6.2's DOMAIN, AS OF TASK 6. They used to be `+0.0 / +1.8 / +3.7`
 * and `−0.0 / −0.8 / −1.6` - `suhii` quantiles, matching an encoding the rebuild no longer uses.
 * §6.2 is one continuous diverging scale over `lst_rel`, clamped at ±4.5 °C, so the ticks are
 * now the start, midpoint and end of THAT domain. They are derived from `ENCODE_DOMAIN` rather
 * than typed, because the alternative is a legend whose numbers and whose map disagree, which is
 * worse than a legend that is merely out of date: the ramp under them is the same expression
 * that colours the polygons. Note the minus signs are U+2212, not hyphens - `d3.format` emits
 * that character and the original's markup used it, so a test pins it.
 *
 * Both strips keep `.ramp i{flex:1}`, so the five swatches are equal widths - the ramp is a
 * KEY to the colours, not a histogram of how many spots fall in each band.
 */

import { useT } from '../app/I18nProvider';
import { ENCODE_DOMAIN } from '../lib/encode.mjs';

/* Exported so the fill-not-ink rule can be asserted on the token list itself. jsdom's CSS
 * parser is unreliable about `background:var(--x)` (it drops the gradient form outright - see
 * the note in Kpis.tsx), so a test that only read `element.style` could pass against `''` and
 * prove nothing. */
export const HOT_RAMP = ['--hot-1', '--hot-2', '--hot-3', '--hot-4', '--hot-5'] as const;
export const COLD_RAMP = ['--cold-1', '--cold-2', '--cold-3', '--cold-4', '--cold-5'] as const;

/* Spec §6.2's domain, from the one place that owns it. `ENCODE_DOMAIN` is `[-4.5, 4.5]`; each
 * ramp shows its own half - 0 to +4.5 for hot, 0 to −4.5 for cold - at three ticks, as the
 * original's markup did (prototype lines 340 and 345).
 *
 * U+2212 MINUS SIGN, not a hyphen, including on `−0.0`: the original wrote the character and
 * `d3.format` renders it, so a hyphen here would be a one-character visible difference in a
 * `.rampL` the fidelity guard measures. */
const MINUS = '−';
const HALF = Math.abs(ENCODE_DOMAIN[1]);
const ticks = (sign: string) => [0, HALF / 2, HALF].map((v) => `${sign}${v.toFixed(1)}`) as unknown as readonly string[];

export const HOT_TICKS: readonly string[] = ticks('+');
export const COLD_TICKS: readonly string[] = ticks(MINUS);

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
