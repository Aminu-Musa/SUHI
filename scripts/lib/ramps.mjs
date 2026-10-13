import { oklchToHex } from './color.mjs';

const DEG = Math.PI / 180;

/** Linear OKLCH ramp. Hue parameters are in DEGREES; oklchToHex takes radians. */
export function buildRamp({ L0, L1, C0, C1, H0, H1, steps = 5 }) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const L = L0 + (L1 - L0) * t;
    const C = C0 + (C1 - C0) * t;
    const H = (H0 + (H1 - H0) * t) * DEG;
    out.push(oklchToHex(L, C, H));
  }
  return out;
}

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

export const RAMPS = deepFreeze({
  nocturne: {
    hot:  { L0: 0.46, L1: 0.93, C0: 0.115, C1: 0.145, H0: 28,  H1: 95 },
    cold: { L0: 0.46, L1: 0.93, C0: 0.115, C1: 0.055, H0: 262, H1: 232 },
  },
  modernist: {
    hot:  { L0: 0.86, L1: 0.42, C0: 0.125, C1: 0.150, H0: 95,  H1: 28 },
    cold: { L0: 0.86, L1: 0.38, C0: 0.060, C1: 0.135, H0: 232, H1: 266 },
  },
});
