import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderRampsCss } from './palette.mjs';
import { THEME_TOKENS, SCALE_TOKENS, DENSITY } from './lib/tokens.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/** Parse `selector { --a: b; }` blocks into { selector: { '--a': 'b' } }. */
function parseBlocks(css) {
  const out = {};
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '').matchAll(/([^{}@;][^{}]*)\{([^}]*)\}/g)) {
    const sel = m[1].trim();
    out[sel] ??= {};
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[sel][d[1]] = d[2].trim();
  }
  return out;
}

describe('renderRampsCss', () => {
  it('emits both theme blocks with all eleven ramp tokens', () => {
    const css = renderRampsCss();
    expect(css).toContain('html[data-theme="nocturne"]');
    expect(css).toContain('--hot-5: #ffe76c;');
    expect(css).toContain('--cold-1: #335698;');
    expect(css).toContain('--neutral-mid: #39404b;');
    expect(css).toContain('html[data-theme="modernist"]');
    expect(css).toContain('--hot-5: #8d1b17;');
    expect(css).toContain('--neutral-mid: #d9dcdf;');
  });

  it('declares no token twice within a theme block', () => {
    for (const block of renderRampsCss().split('html[data-theme=').slice(1)) {
      const names = [...block.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('matches the committed _ramps.css', () => {
    expect(read('../src/styles/_ramps.css')).toBe(renderRampsCss());
  });
});

describe('token module', () => {
  it('pins the track and bar-cap tokens', () => {
    expect(THEME_TOKENS.nocturne['--track']).toBe('#b6bdc9');
    expect(THEME_TOKENS.modernist['--track']).toBe('#c2c8cf');
    expect(SCALE_TOKENS['--bar-cap']).toBe('2px');
  });

  it('carries every per-theme token for both themes', () => {
    const names = ['--bg', '--surface', '--surface-2', '--rule-color', '--rule-strong-color',
      '--text', '--text-muted', '--accent', '--on-accent', '--hot-ink', '--cold-ink',
      '--neutral-mid', '--track'];
    for (const t of ['nocturne', 'modernist']) {
      expect(Object.keys(THEME_TOKENS[t]).sort()).toEqual([...names].sort());
    }
  });
});

describe('suhi-tokens.css', () => {
  const css = read('../src/styles/suhi-tokens.css');
  const blocks = parseBlocks(css);

  it('imports the generated ramps and names the generator', () => {
    expect(css).toContain('@import "./_ramps.css";');
    expect(css).toContain('npm run palette');
  });

  it('renders SCALE_TOKENS verbatim in :root, with exactly those keys', () => {
    for (const [k, v] of Object.entries(SCALE_TOKENS)) expect(blocks[':root'][k]).toBe(v);
    expect(Object.keys(blocks[':root']).sort()).toEqual(Object.keys(SCALE_TOKENS).sort());
  });

  it('has each selector exactly once', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '');
    const sels = [...body.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim());
    expect(new Set(sels).size).toBe(sels.length);
  });

  it('spells out the spec values', () => {
    expect(SCALE_TOKENS['--space-1']).toBe('4px');
    expect(SCALE_TOKENS['--space-12']).toBe('48px');
    expect(SCALE_TOKENS['--radius-md']).toBe('2px');
    expect(SCALE_TOKENS['--rule-strong']).toBe('2px');
    expect(SCALE_TOKENS['--hit']).toBe('44px');
    expect(SCALE_TOKENS['--font-display']).toBe('800 34px/1.1');
    expect(SCALE_TOKENS['--font-family']).toBe('Archivo, system-ui, sans-serif');
  });

  it('declares each per-theme token as in THEME_TOKENS, once per block', () => {
    for (const t of ['nocturne', 'modernist']) {
      const block = blocks[`html[data-theme="${t}"]`];
      for (const [k, v] of Object.entries(THEME_TOKENS[t])) {
        if (k === '--neutral-mid') continue; // generated into _ramps.css
        expect(block[k]).toBe(v);
      }
      // Exact key set: a stray --hot-N or --neutral-mid here would silently override _ramps.css.
      const expected = Object.keys(THEME_TOKENS[t]).filter(k => k !== '--neutral-mid').sort();
      expect(Object.keys(block).sort()).toEqual(expected);
    }
    for (const sel of Object.keys(blocks)) {
      const body = css.split(sel + ' {')[1]?.split('}')[0] ?? '';
      const names = [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('scales the spacing ladder by density', () => {
    const spaceKeys = Object.keys(SCALE_TOKENS).filter(k => k.startsWith('--space-'));
    for (const mode of ['compact', 'touch']) {
      const b = blocks[`html[data-density="${mode}"]`];
      for (const k of spaceKeys) {
        const px = parseFloat(SCALE_TOKENS[k]);
        expect(parseFloat(b[k])).toBeCloseTo(px * DENSITY[mode], 5);
      }
    }
    expect(blocks['html[data-density="touch"]']['--hit']).toBe('44px');
    expect(blocks['html[data-density="default"]']).toBeUndefined();
  });
});
