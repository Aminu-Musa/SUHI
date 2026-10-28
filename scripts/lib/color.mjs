// Colour maths: sRGB hex <-> OKLCH (H in radians) and WCAG 2.1 contrast.

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToLinear(hex) {
  return parseHex(hex).map((v) => toLinear(v / 255));
}

export function hexToOklch(hex) {
  const [r, g, b] = hexToLinear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let H = Math.atan2(bb, a);
  if (H < 0) H += 2 * Math.PI;
  return { L, C, H };
}

export function oklchToHex(L, C, H) {
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    lin
      .map((v) => {
        const c = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
        return Math.round(toGamma(c) * 255).toString(16).padStart(2, '0');
      })
      .join('')
  );
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * `foreground` composited over `ground` at `pct`, in sRGB — the maths CSS does for
 * `color-mix(in srgb, <foreground> <pct>%, <ground>)`.
 *
 * Gamma-encoded channels, rounded to 8 bits, because that is what `in srgb` means and what
 * the browser computes: it is NOT the linear-light average, and the two differ by enough to
 * change a contrast verdict. Verified against a rendered page in color.test.mjs.
 *
 * Exists for the one text ground that is not a declared token: the 12% accent wash under
 * `.pk[aria-pressed=true]`. See INK_EXTRA_GROUNDS in ink.mjs.
 */
export function mixSrgb(foreground, ground, pct) {
  if (!(pct >= 0 && pct <= 1)) throw new Error(`mixSrgb: pct must be 0..1, got ${pct}`);
  const [a, b] = [parseHex(foreground), parseHex(ground)];
  const out = a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
