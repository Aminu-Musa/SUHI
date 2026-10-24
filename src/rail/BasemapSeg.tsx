/* Rail group 4 - the basemap segment. Markup from prototype lines 289-292, buttons from
 * `renderBaseSeg`, lines 662-667.
 *
 * RULING 29 SUPERSEDES RULING 25. Ruling 25 kept all five Esri raster layers on the grounds
 * that spec §3's Changed table does not sanction a basemap change. §8.3 is now APPROVED BY THE
 * USER (2026-10-23) and overrides it: the five Esri rasters are replaced by one self-hosted
 * Protomaps VECTOR basemap styled from `THEME_TOKENS`, so roads, water, landuse and the national
 * outline flip with `data-theme` like everything else, the Esri dependency and its API-key
 * question are gone, and tile failure becomes near-impossible because we serve the file. It is a
 * sanctioned VISIBLE departure and carries an `ALLOWED_DIFFS` entry citing spec §8.3 - the first
 * exemption authorised by the user rather than by §3 or §9.1.
 *
 * WHY THREE OPTIONS AND NOT FIVE. The five were five raster PROVIDERS. There is one provider
 * now, so what is left to offer is what the vector basemap can actually be: a palette and a
 * density. `Relief` and `Imagery` have no vector counterpart at all - shaded relief is a raster
 * product and satellite imagery is photographs - and inventing a fake "Relief" out of landuse
 * fills would be worse than dropping the option, because the label would be a claim about data
 * that is not there. `Gray` was reaching for "quieter ground", which is exactly what `Plain`
 * now is, built from the active theme's own neutrals rather than from someone else's grey.
 *
 * `dark` AND `topo` KEEP THEIR KEYS, and that is not cosmetic: ruling 7 maps `nocturne -> dark`
 * and `modernist -> topo`, so those two strings are the contract between the theme effect in
 * App and this segment. See `src/map/style.ts` for what each one paints.
 *
 * Each label is still `b.label.split(' ')[1]` - the SECOND WORD - so 'Vector Dark' renders as
 * 'Dark'. That is why these labels are not in the dictionary: they are derived from the config
 * at render time, in English, in all four languages, exactly as the Esri ones were.
 *
 * The inline `font-size:10.5px` on every button is the original's, and it is the one the
 * fidelity guard measures: `.seg button` resolves to this group's first button, because the
 * basemap group precedes the contour group in the rail. The guard's `.seg button` WIDTH is what
 * the §8.3 exemption covers - `.seg button{flex:1}`, so three options are wider than five.
 *
 * RULING 7: a click here latches `userPickedBase` TRUE, permanently. From that moment a theme
 * change no longer drags the basemap along (the latch is read by App's theme effect), and
 * nothing in the original ever resets it. `onPickBase` is what App's `pickBase` runs; the map
 * consumes the resulting `baseKey` as a prop rather than through an imperative `setBase`.
 */

import { useT } from '../app/I18nProvider';
import { BASEMAP_VARIANTS, BASE_KEYS, type BaseKey } from '../map/style';
import { Seg } from './Seg';

export type { BaseKey };
export { BASEMAP_VARIANTS as BASES, BASE_KEYS };

/** `b.label.split(' ')[1]`, prototype line 665. */
export const baseButtonLabel = (key: BaseKey): string => BASEMAP_VARIANTS[key].label.split(' ')[1];

const OPTIONS = BASE_KEYS.map((k) => ({
  value: k,
  label: baseButtonLabel(k),
  style: { fontSize: '10.5px' },
}));

export interface BasemapSegProps {
  readonly baseKey: BaseKey;
  readonly onPickBase: (key: BaseKey) => void;
}

export function BasemapSeg({ baseKey, onPickBase }: BasemapSegProps) {
  const t = useT();
  return (
    <div>
      <div className="sec-h" data-i18n="basemap">
        {t('basemap')}
      </div>
      <Seg id="baseSeg" options={OPTIONS} value={baseKey} onChange={(v) => onPickBase(v as BaseKey)} />
      <p className="note" style={{ margin: '6px 0 0' }} data-i18n="basemap_note">
        {t('basemap_note')}
      </p>
    </div>
  );
}
