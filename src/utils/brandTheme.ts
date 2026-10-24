import { BrandTheme, DEFAULT_BRAND_THEME, BrandPaletteId } from '../types';

export type BrandPalette = {
  id: BrandPaletteId;
  labelKey: string;
  sidebar: string;
  canvas: string;
  ink: string;
  accent: string;
  soft: string;
  highlight: string;
  card: string;
};

/** Clearly distinct curated themes (sidebar + page + chrome). */
export const BRAND_PALETTES: BrandPalette[] = [
  {
    id: 'espresso',
    labelKey: 'themeEspresso',
    sidebar: '#1E1B18',
    canvas: '#F2EEE8',
    ink: '#5D4037',
    accent: '#CFA378',
    soft: '#F8ECD0',
    highlight: '#E8ECCB',
    card: '#FAFAFA',
  },
  {
    id: 'forest',
    labelKey: 'themeForest',
    sidebar: '#143528',
    canvas: '#E5F0E9',
    ink: '#1B4332',
    accent: '#57B288',
    soft: '#CEE6D8',
    highlight: '#B9E2C7',
    card: '#F2F7F4',
  },
  {
    id: 'ocean',
    labelKey: 'themeOcean',
    sidebar: '#023E8A',
    canvas: '#E3EFF7',
    ink: '#023E8A',
    accent: '#0DAFD0',
    soft: '#BBE1F0',
    highlight: '#96DEEB',
    card: '#F0F6FA',
  },
  {
    id: 'wine',
    labelKey: 'themeWine',
    sidebar: '#4A0E2A',
    canvas: '#F6E7E9',
    ink: '#6D1B3A',
    accent: '#DA7E9B',
    soft: '#F0CBD5',
    highlight: '#F4D6DE',
    card: '#FAF3F5',
  },
  {
    id: 'midnight',
    labelKey: 'themeMidnight',
    sidebar: '#0B1020',
    canvas: '#E4E7F0',
    ink: '#1E293B',
    accent: '#686BE8',
    soft: '#C8CEE9',
    highlight: '#A8B6F7',
    card: '#F3F4FA',
  },
  {
    id: 'terracotta',
    labelKey: 'themeTerracotta',
    sidebar: '#7C2D12',
    canvas: '#FAECE3',
    ink: '#9A3412',
    accent: '#ED7421',
    soft: '#FAD7AE',
    highlight: '#F6BA7B',
    card: '#FAF6F2',
  },
  {
    id: 'violet',
    labelKey: 'themeViolet',
    sidebar: '#3B0764',
    canvas: '#F0E9FA',
    ink: '#5B21B6',
    accent: '#C08AF6',
    soft: '#E9D7FD',
    highlight: '#DED8FC',
    card: '#F7F5FA',
  },
  {
    id: 'graphite',
    labelKey: 'themeGraphite',
    sidebar: '#111827',
    canvas: '#EEEFF1',
    ink: '#111827',
    accent: '#83C420',
    soft: '#D1D5DA',
    highlight: '#BDEC6C',
    card: '#FAFAFA',
  },
  {
    id: 'sunrise',
    labelKey: 'themeSunrise',
    sidebar: '#422006',
    canvas: '#FAF6E6',
    ink: '#92400E',
    accent: '#F2BC30',
    soft: '#F8E491',
    highlight: '#F5D057',
    card: '#FAF7F0',
  },
  {
    id: 'arctic',
    labelKey: 'themeArctic',
    sidebar: '#0F766E',
    canvas: '#EBF8F5',
    ink: '#115E59',
    accent: '#37CEBB',
    soft: '#9FF2E2',
    highlight: '#67E5D1',
    card: '#F2FAF9',
  },
];

const LEGACY_PALETTE_MAP: Record<string, BrandPaletteId> = {
  olive: 'forest',
  slate: 'graphite',
  navy: 'ocean',
  cocoa: 'terracotta',
};

const parseHex = (hex: string): [number, number, number] | null => {
  const h = hex.trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  return null;
};

export const relativeLuminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const lin = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

export const contrastingInk = (bgHex: string): string =>
  relativeLuminance(bgHex) > 0.45 ? '#1A1512' : '#F7F3ED';

export const mutedInk = (bgHex: string): string => {
  const ink = contrastingInk(bgHex);
  return ink === '#F7F3ED' ? 'rgba(247, 243, 237, 0.55)' : 'rgba(26, 21, 18, 0.45)';
};

const hexDist = (a: string, b: string) => {
  const aa = parseHex(a);
  const bb = parseHex(b);
  if (!aa || !bb) return Number.POSITIVE_INFINITY;
  return Math.abs(aa[0] - bb[0]) + Math.abs(aa[1] - bb[1]) + Math.abs(aa[2] - bb[2]);
};

export const getPaletteById = (id?: string | null): BrandPalette => {
  const mapped = id ? LEGACY_PALETTE_MAP[id] || id : null;
  return BRAND_PALETTES.find(p => p.id === mapped) || BRAND_PALETTES[0];
};

/** Map a saved theme (palette id or legacy free colours) onto a curated palette. */
export const resolveBrandPalette = (theme?: Partial<BrandTheme> | Record<string, unknown> | null): BrandPalette => {
  const raw = (theme || {}) as Record<string, unknown>;
  if (typeof raw.paletteId === 'string') {
    return getPaletteById(raw.paletteId);
  }
  const sidebar =
    (typeof raw.sidebar === 'string' && raw.sidebar) ||
    (typeof raw.primary === 'string' && raw.primary) ||
    '';
  const canvas =
    (typeof raw.canvas === 'string' && raw.canvas) ||
    (typeof raw.surface === 'string' && raw.surface) ||
    '';
  if (sidebar || canvas) {
    let best = BRAND_PALETTES[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of BRAND_PALETTES) {
      const score =
        (sidebar ? hexDist(sidebar, p.sidebar) : 0) + (canvas ? hexDist(canvas, p.canvas) : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }
  return getPaletteById((DEFAULT_BRAND_THEME.paletteId || 'espresso') as BrandPaletteId);
};

const mixHex = (a: string, b: string, weight: number): string => {
  const aa = parseHex(a)!;
  const bb = parseHex(b)!;
  return '#' + aa.map((v, i) => Math.round(v * weight + bb[i] * (1 - weight)).toString(16).padStart(2, '0')).join('');
};

export const appearancePalette = (base: BrandPalette, mode: 'light' | 'dark'): BrandPalette => mode === 'light' ? base : {
  ...base,
  sidebar: mixHex(base.sidebar, '#090c10', 0.3),
  canvas: mixHex(base.sidebar, '#101318', 0.22),
  card: mixHex(base.sidebar, '#22272e', 0.18),
  ink: mixHex(base.canvas, '#f4f5f7', 0.3),
  accent: mixHex(base.accent, '#ffffff', 0.65),
  soft: mixHex(base.sidebar, '#414752', 0.18),
  highlight: mixHex(base.accent, '#252b34', 0.18),
};

export const applyBrandThemeToDocument = (
  theme?: Partial<BrandTheme> | null,
  mode: 'light' | 'dark' = document.documentElement.dataset.accountAppearance === 'dark' ? 'dark' : 'light',
) => {
  const palette = appearancePalette(resolveBrandPalette(theme), mode);
  document.documentElement.dataset.accountAppearance = mode;
  document.documentElement.style.colorScheme = mode;
  const root = document.documentElement;
  const sidebarInk = contrastingInk(palette.sidebar);
  const canvasInk = contrastingInk(palette.canvas);
  const btnFg = contrastingInk(palette.ink);
  const accentFg = contrastingInk(palette.accent);

  root.style.setProperty('--app-sidebar-bg', palette.sidebar);
  root.style.setProperty('--app-sidebar-fg', sidebarInk);
  root.style.setProperty('--app-sidebar-muted', mutedInk(palette.sidebar));
  root.style.setProperty('--app-sidebar-accent', palette.accent);
  root.style.setProperty('--app-sidebar-accent-fg', accentFg);
  root.style.setProperty('--app-sidebar-chip', `color-mix(in srgb, ${palette.accent} 22%, ${palette.sidebar})`);
  root.style.setProperty('--app-canvas-bg', palette.canvas);
  root.style.setProperty('--app-canvas-fg', canvasInk);
  root.style.setProperty('--app-card-bg', palette.card);
  root.style.setProperty('--app-btn-fg', btnFg);

  root.style.setProperty('--color-bakery-cream', palette.canvas);
  root.style.setProperty('--color-bakery-brown', palette.ink);
  root.style.setProperty('--color-bakery-caramel', palette.accent);
  root.style.setProperty('--color-bakery-beige', palette.soft);
  root.style.setProperty('--color-bakery-accent', palette.highlight);
};

export const clearBrandThemeFromDocument = () => {
  applyBrandThemeToDocument(DEFAULT_BRAND_THEME);
};
