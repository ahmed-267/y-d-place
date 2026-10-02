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
    canvas: '#F7F3ED',
    ink: '#5D4037',
    accent: '#D4A373',
    soft: '#FAEDCD',
    highlight: '#E9EDC9',
    card: '#FFFFFF',
  },
  {
    id: 'forest',
    labelKey: 'themeForest',
    sidebar: '#143528',
    canvas: '#EAF5EE',
    ink: '#1B4332',
    accent: '#52B788',
    soft: '#CDE7D8',
    highlight: '#B7E4C7',
    card: '#F7FCF9',
  },
  {
    id: 'ocean',
    labelKey: 'themeOcean',
    sidebar: '#023E8A',
    canvas: '#E8F4FC',
    ink: '#023E8A',
    accent: '#00B4D8',
    soft: '#B8E2F2',
    highlight: '#90E0EF',
    card: '#F5FBFF',
  },
  {
    id: 'wine',
    labelKey: 'themeWine',
    sidebar: '#4A0E2A',
    canvas: '#FBECEE',
    ink: '#6D1B3A',
    accent: '#E07A9A',
    soft: '#F2C9D4',
    highlight: '#F6D5DE',
    card: '#FFF8FA',
  },
  {
    id: 'midnight',
    labelKey: 'themeMidnight',
    sidebar: '#0B1020',
    canvas: '#E9ECF5',
    ink: '#1E293B',
    accent: '#6366F1',
    soft: '#C7CDEB',
    highlight: '#A5B4FC',
    card: '#F8F9FF',
  },
  {
    id: 'terracotta',
    labelKey: 'themeTerracotta',
    sidebar: '#7C2D12',
    canvas: '#FFF1E8',
    ink: '#9A3412',
    accent: '#F97316',
    soft: '#FED7AA',
    highlight: '#FDBA74',
    card: '#FFFBF7',
  },
  {
    id: 'violet',
    labelKey: 'themeViolet',
    sidebar: '#3B0764',
    canvas: '#F5EEFF',
    ink: '#5B21B6',
    accent: '#C084FC',
    soft: '#E9D5FF',
    highlight: '#DDD6FE',
    card: '#FCFAFF',
  },
  {
    id: 'graphite',
    labelKey: 'themeGraphite',
    sidebar: '#111827',
    canvas: '#F3F4F6',
    ink: '#111827',
    accent: '#84CC16',
    soft: '#D1D5DB',
    highlight: '#BEF264',
    card: '#FFFFFF',
  },
  {
    id: 'sunrise',
    labelKey: 'themeSunrise',
    sidebar: '#422006',
    canvas: '#FFFBEB',
    ink: '#92400E',
    accent: '#FBBF24',
    soft: '#FDE68A',
    highlight: '#FCD34D',
    card: '#FFFCF5',
  },
  {
    id: 'arctic',
    labelKey: 'themeArctic',
    sidebar: '#0F766E',
    canvas: '#F0FDFA',
    ink: '#115E59',
    accent: '#2DD4BF',
    soft: '#99F6E4',
    highlight: '#5EEAD4',
    card: '#F7FFFE',
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

export const applyBrandThemeToDocument = (theme?: Partial<BrandTheme> | null) => {
  const palette = resolveBrandPalette(theme);
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
