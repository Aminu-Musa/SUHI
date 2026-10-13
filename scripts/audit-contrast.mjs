import { pathToFileURL } from 'node:url';
import { contrastRatio } from './lib/color.mjs';
import { THEME_TOKENS } from './lib/tokens.mjs';
import { buildRamp, RAMPS } from './lib/ramps.mjs';

const TEXT_FLOOR = 4.5;
const FILL_FLOOR = 1.0; // fills are geometry, not text: recorded for visibility, never failed on

const TEXT_ON_SURFACE = ['--text', '--text-muted', '--accent', '--hot-ink', '--cold-ink'];

/**
 * Audit every text pair in every theme.
 * `overrides` is a test seam: { 'theme/--token': '#hex' } replaces that row's foreground.
 */
export function auditPairs({ overrides = {} } = {}) {
  const rows = [];
  const add = (use, fg, bg, floor) => {
    const fgHex = overrides[use] ?? fg;
    const ratio = contrastRatio(fgHex, bg);
    rows.push({ use, fg: fgHex, bg, ratio, floor, pass: ratio >= floor });
  };

  for (const theme of Object.keys(THEME_TOKENS)) {
    const t = THEME_TOKENS[theme];
    for (const name of TEXT_ON_SURFACE) add(`${theme}/${name}`, t[name], t['--surface-2'], TEXT_FLOOR);
    add(`${theme}/--on-accent`, t['--on-accent'], t['--accent'], TEXT_FLOOR);
    for (const family of ['hot', 'cold']) {
      buildRamp(RAMPS[theme][family]).forEach((hex, i) =>
        add(`${theme}/--${family}-${i + 1}`, hex, t['--bg'], FILL_FLOOR),
      );
    }
  }
  return rows;
}

export function formatTable(rows) {
  const w = Math.max(...rows.map((r) => r.use.length));
  const head = `${'pair'.padEnd(w)}  fg       bg       ratio  floor  result`;
  const lines = rows.map(
    (r) =>
      `${r.use.padEnd(w)}  ${r.fg}  ${r.bg}  ${r.ratio.toFixed(2).padStart(5)}  ${r.floor.toFixed(1).padStart(5)}  ${r.pass ? 'PASS' : 'FAIL'}`,
  );
  return [head, ...lines].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = auditPairs();
  console.log(formatTable(rows));
  const failed = rows.filter((r) => !r.pass);
  console.log(failed.length ? `\n${failed.length} pair(s) FAILED` : '\nAll pairs pass');
  process.exit(failed.length ? 1 : 0);
}
