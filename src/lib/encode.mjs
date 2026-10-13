/**
 * The single owner of "what colour means" (spec §6.1). Every polygon fill
 * resolves through encodeValue; nothing else may read mean_lst to pick a colour.
 *
 * INTERIM PROXY, NOT THE REAL STATISTIC. `lst_rel` is a spot's mean_lst minus
 * the mean of its own city's L50 spots for the SAME period. It is deliberately
 * not called gi_z: it is not the Gi* z-score. When the study supplies Gi*, only
 * encodeValue's body and the legend string change - not the ramp, the domain
 * shape, the map style, or any component.
 *
 * Why not suhii: its sign agrees with hot/cold only 53.5% of the time (93% wrong
 * for night-cold). lst_rel agrees 86.3%. Period matching is essential: day and
 * night are separate acquisitions and must not contaminate each other.
 */

export const ENCODE_FIELD = 'lst_rel';

/** Symmetric diverging domain in degrees C; midpoint 0 maps to the neutral colour. */
export const ENCODE_DOMAIN = [-4.5, 4.5];

const key = (city, period) => `${city}|${period}`;

/**
 * Mean mean_lst per `${city}|${period}`, over L50 features with a non-null
 * mean_lst only. Null rows are skipped so they cannot poison a reference.
 * @returns {Map<string, number>}
 */
export function buildReferenceMeans(features) {
  const acc = new Map();
  for (const { properties: p } of features) {
    if (p.contour_level !== 'L50' || p.mean_lst == null) continue;
    const k = key(p.city, p.period);
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += p.mean_lst;
    a.n += 1;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, { sum, n }]) => [k, sum / n]));
}

/**
 * lst_rel for one spot, or null (never NaN/undefined) when mean_lst is null
 * or no reference mean exists for its city/period.
 * @returns {number | null}
 */
export function encodeValue(props, refs) {
  if (props.mean_lst == null) return null;
  const ref = refs.get(key(props.city, props.period));
  if (ref === undefined) return null;
  return props.mean_lst - ref;
}
