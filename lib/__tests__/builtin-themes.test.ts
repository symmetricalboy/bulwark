import { describe, it, expect } from 'vitest';
import { BUILTIN_THEMES } from '../builtin-themes';

describe('BUILTIN_THEMES', () => {
  it('contains exactly 11 themes', () => {
    expect(BUILTIN_THEMES).toHaveLength(11);
  });

  it('includes the comail brand theme', () => {
    const ids = BUILTIN_THEMES.map(t => t.id);
    expect(ids).toContain('builtin-comail');
  });

  it('all themes have required fields', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.version).toBeTruthy();
      expect(theme.author).toBe('Built-in');
      expect(theme.css).toBeTruthy();
      expect(theme.variants).toEqual(['light', 'dark']);
      expect(theme.enabled).toBe(true);
      expect(theme.builtIn).toBe(true);
    }
  });

  it('all IDs are prefixed with builtin-', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toMatch(/^builtin-/);
    }
  });

  it('all themes have both :root and .dark selectors', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.css).toContain(':root');
      expect(theme.css).toContain('.dark');
    }
  });

  it('all themes set --color-primary', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.css).toContain('--color-primary:');
    }
  });

  it('themes have correct names', () => {
    const names = BUILTIN_THEMES.map(t => t.name);
    expect(names).toContain('Comail');
    expect(names).toContain('Flat fields');
    expect(names).toContain('Nord');
    expect(names).toContain('Catppuccin');
    expect(names).toContain('Solarized');
    expect(names).toContain('Roundcube Elastic');
    expect(names).toContain('Aurora Glass');
    expect(names).toContain('Matcha Green');
    expect(names).toContain('Royal Blue');
    expect(names).toContain('Sandstone');
  });

  it('theme IDs are unique', () => {
    const ids = BUILTIN_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('WCAG accessibility & contrast compliance', () => {
    function hexToRgb(hex: string): [number, number, number, number] {
      const clean = hex.replace('#', '').trim();
      const expanded = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const num = parseInt(expanded, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
    }

    function parseRgb(color: string, bgRgb: [number, number, number, number] = [255, 255, 255, 1]): [number, number, number, number] | null {
      const trimmed = color.trim();
      if (trimmed.startsWith('#')) return hexToRgb(trimmed);
      const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        const a = match[4] !== undefined ? Number(match[4]) : 1;
        const compR = Math.round(r * a + bgRgb[0] * (1 - a));
        const compG = Math.round(g * a + bgRgb[1] * (1 - a));
        const compB = Math.round(b * a + bgRgb[2] * (1 - a));
        return [compR, compG, compB, 1];
      }
      return null;
    }

    function luminance(r: number, g: number, b: number): number {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrast(rgb1: [number, number, number, number], rgb2: [number, number, number, number]): number {
      const lum1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
      const lum2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    function extractVars(block: string): Record<string, string> {
      const vars: Record<string, string> = {};
      for (const line of block.split('\n')) {
        const m = line.match(/--([\w-]+):\s*([^;]+);/);
        if (m) vars[m[1]] = m[2].trim();
      }
      return vars;
    }

    it('all themes meet WCAG AA contrast (>= 4.5:1) for primary action buttons in light and dark variants', () => {
      for (const theme of BUILTIN_THEMES) {
        const rootMatch = theme.css.match(/:root\s*\{([\s\S]*?)\}/);
        const darkMatch = theme.css.match(/\.dark\s*\{([\s\S]*?)\}/);
        const rootVars = extractVars(rootMatch ? rootMatch[1] : '');
        const darkVars = extractVars(darkMatch ? darkMatch[1] : '');

        for (const [mode, vars] of [['light', rootVars], ['dark', darkVars]] as const) {
          const bg = vars['color-primary'];
          const fg = vars['color-primary-foreground'];
          if (!bg || !fg) continue;
          const bgRgb = parseRgb(bg);
          const fgRgb = parseRgb(fg, bgRgb ?? undefined);
          expect(bgRgb, `${theme.name} (${mode}) primary bg parsed`).not.toBeNull();
          expect(fgRgb, `${theme.name} (${mode}) primary fg parsed`).not.toBeNull();
          const ratio = getContrast(bgRgb!, fgRgb!);
          expect(
            ratio,
            `${theme.name} (${mode}) primary button contrast [${bg} vs ${fg}] must be >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('all themes meet WCAG AA contrast (>= 4.5:1) for normal text in light and dark variants', () => {
      for (const theme of BUILTIN_THEMES) {
        const rootMatch = theme.css.match(/:root\s*\{([\s\S]*?)\}/);
        const darkMatch = theme.css.match(/\.dark\s*\{([\s\S]*?)\}/);
        const rootVars = extractVars(rootMatch ? rootMatch[1] : '');
        const darkVars = extractVars(darkMatch ? darkMatch[1] : '');

        for (const [mode, vars] of [['light', rootVars], ['dark', darkVars]] as const) {
          const bg = vars['color-background'];
          const fg = vars['color-foreground'];
          if (!bg || !fg) continue;
          const bgRgb = parseRgb(bg);
          const fgRgb = parseRgb(fg, bgRgb ?? undefined);
          expect(bgRgb).not.toBeNull();
          expect(fgRgb).not.toBeNull();
          const ratio = getContrast(bgRgb!, fgRgb!);
          expect(
            ratio,
            `${theme.name} (${mode}) text contrast [${bg} vs ${fg}] must be >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('all themes meet WCAG AA contrast (>= 4.5:1) for destructive buttons in light and dark variants', () => {
      for (const theme of BUILTIN_THEMES) {
        const rootMatch = theme.css.match(/:root\s*\{([\s\S]*?)\}/);
        const darkMatch = theme.css.match(/\.dark\s*\{([\s\S]*?)\}/);
        const rootVars = extractVars(rootMatch ? rootMatch[1] : '');
        const darkVars = extractVars(darkMatch ? darkMatch[1] : '');

        for (const [mode, vars] of [['light', rootVars], ['dark', darkVars]] as const) {
          const bg = vars['color-destructive'];
          const fg = vars['color-destructive-foreground'];
          if (!bg || !fg) continue;
          const bgRgb = parseRgb(bg);
          const fgRgb = parseRgb(fg, bgRgb ?? undefined);
          expect(bgRgb).not.toBeNull();
          expect(fgRgb).not.toBeNull();
          const ratio = getContrast(bgRgb!, fgRgb!);
          expect(
            ratio,
            `${theme.name} (${mode}) destructive contrast [${bg} vs ${fg}] must be >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
});
