/* Rail group 4 - the basemap segment. Markup from prototype lines 289-292, buttons from
 * `renderBaseSeg`, lines 662-667, `BASES` from lines 579-590.
 *
 * RULING 25: all FIVE Esri options stay. Spec §8.3 argues for replacing the raster basemaps
 * with a PMTiles vector style and dropping the segment to two or three choices, but §3's
 * Changed table does not sanction it, and §3 is the authority for what this rebuild renders.
 * Do not reduce the options and do not swap in PMTiles here.
 *
 * Each label is `b.label.split(' ')[1]` - the SECOND WORD of the BASES label, so 'Esri Dark'
 * renders as 'Dark'. That is why these labels are not in the dictionary: they are derived from
 * the config at render time, in English, in all four languages.
 *
 * The inline `font-size:10.5px` on every button is the original's, and it is the one the
 * fidelity guard measures: `.seg button` resolves to this group's first button, because the
 * basemap group precedes the contour group in the rail.
 *
 * RULING 7: a click here latches `userPickedBase` TRUE, permanently. From that moment a theme
 * change no longer drags the basemap along (the latch is read by App's theme effect), and
 * nothing in the original ever resets it. `onPickBase` is the seam for Task 6's `setBase`.
 */

import { useT } from '../app/I18nProvider';
import { Seg } from './Seg';

export type BaseKey = 'dark' | 'topo' | 'relief' | 'gray' | 'imagery';

export interface BaseDef {
  readonly label: string;
  readonly url: string;
  readonly attr: string;
  /** `maxNativeZoom` - how far each Esri service actually has tiles. */
  readonly max: number;
}

/** Prototype lines 579-590, verbatim. Task 6 consumes the url/attr/max fields in `setBase`. */
export const BASES: Readonly<Record<BaseKey, BaseDef>> = {
  dark: {
    label: 'Esri Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    max: 16,
  },
  topo: {
    label: 'Esri Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    max: 19,
  },
  relief: {
    label: 'Esri Relief',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri — Source: Esri',
    max: 13,
  },
  gray: {
    label: 'Esri Gray',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    max: 16,
  },
  imagery: {
    label: 'Esri Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    max: 19,
  },
};

export const BASE_KEYS = Object.keys(BASES) as BaseKey[];

/** `b.label.split(' ')[1]`, prototype line 665. */
export const baseButtonLabel = (key: BaseKey): string => BASES[key].label.split(' ')[1];

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
