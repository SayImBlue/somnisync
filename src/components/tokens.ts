export const COLORS = {
  BACKGROUND: '#080810',
  SURFACE: '#0F0F1A',
  SURFACE_ELEVATED: '#141425',
  BORDER: '#1C1C30',
  ACCENT: '#7B9CFF',
  ACCENT_GLOW: 'rgba(123,156,255,0.15)',
  TEXT_PRIMARY: '#EEEEFF',
  TEXT_SECONDARY: '#8888AA',
  TEXT_DIM: '#44445A',
  PHASE_LIGHT: '#7B9CFF',
  PHASE_DEEP: '#4A5899',
  PHASE_AWAKE: '#44445A',
  PHASE_TRANSITIONAL: '#9B8FCC',
  PHASE_SIGNAL_LOST: '#CC4455',
  SUCCESS: '#4ECDC4',
  WARNING: '#FFB347',
  DANGER: '#CC4455',
  WHITE: '#FFFFFF',
  BACKDROP: 'rgba(8,8,16,0.85)',
  CARD_BG: '#0F0F1A',
  CARD_BORDER: '#1C1C30',
  TEXT_MUTED: '#8888AA',
  ACCENT_SECONDARY: '#4A5899',
  ERROR: '#CC4455',
  SIGNAL_LOST: '#CC4455',
};

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  XXL: 24,
  XXXL: 32,
  XXXXL: 48,
  XXXXXL: 64,
};

export const FONT_SIZES = {
  XS: 12,
  SM: 14,
  MD: 16,
  LG: 20,
  XL: 24,
  XXL: 32,
  DISPLAY: 48,
  HERO: 64,
};

export const RADIUS = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 24,
  FULL: 999,
  CARD: 16,
  BUTTON: 999,
  SMALL: 8,
};

export const SHADOWS = {
  CARD: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 4,
  },
  GLOW: {
    shadowColor: '#7B9CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 0,
  },
};

export const ANIM = {
  FAST: 150,
  NORMAL: 220,
  SLOW: 320,
};

export const TYPOGRAPHY = {
  DISPLAY: 'Syne_700Bold',
  BODY: 'DMSans_400Regular',
  MEDIUM: 'DMSans_500Medium',
};

const tokens = {
  COLORS,
  SPACING,
  FONT_SIZES,
  RADIUS,
  SHADOWS,
  ANIM,
  TYPOGRAPHY,
};

export default tokens;
