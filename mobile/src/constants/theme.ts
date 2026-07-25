/**
 * Local SEO Ranker design tokens.
 *
 * Colors mirror the web app's CSS variables in client/global.css:
 *   light primary hsl(200 95% 45%) ≈ #0697E0, dark primary hsl(200 95% 50%) ≈ #06A8F9,
 *   dark background hsl(224 20% 8%) ≈ #101219, radius 0.75rem.
 *
 * The *Strong variants are text-on-soft-background colors chosen to clear
 * WCAG AA contrast for small badge text in both modes.
 */

export const Colors = {
  light: {
    background: '#F6F8FB',
    card: '#FFFFFF',
    cardPressed: '#F1F5F9',
    raised: '#FFFFFF',
    border: '#E2E8F0',
    text: '#2C3844',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    primary: '#0697E0',
    onPrimary: '#FFFFFF',
    primarySoft: '#E0F2FE',
    primaryStrong: '#0369A1',
    success: '#059669',
    successSoft: '#D1FAE5',
    successStrong: '#047857',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    warningStrong: '#92400E',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    dangerStrong: '#B91C1C',
    neutralStrong: '#475569',
    star: '#F59E0B',
    input: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
  },
  dark: {
    background: '#101219',
    card: '#161A24',
    cardPressed: '#1D2330',
    raised: '#2A3346',
    border: '#232B3B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#06A8F9',
    onPrimary: '#0B1220',
    primarySoft: '#0C2B40',
    primaryStrong: '#4FC3FF',
    success: '#34D399',
    successSoft: '#0B2E23',
    successStrong: '#34D399',
    warning: '#FBBF24',
    warningSoft: '#33260B',
    warningStrong: '#FBBF24',
    danger: '#F87171',
    dangerSoft: '#3A1616',
    dangerStrong: '#F87171',
    neutralStrong: '#A9B4C6',
    star: '#FBBF24',
    input: '#161A24',
    tabBar: '#12151E',
    tabBarBorder: '#232B3B',
  },
} as const;

export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Matches the web app's --radius: 0.75rem scale (lg = 12, md = -2px, sm = -4px). */
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;
