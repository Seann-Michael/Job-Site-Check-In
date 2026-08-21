/**
 * Local SEO Ranker design tokens.
 *
 * Modern / bold / clean / minimal system. Keeps the brand blue but makes the
 * primary bolder, backgrounds softer, corners rounder and shadows lighter.
 *
 * The *Strong variants are text-on-soft-background colors chosen to clear
 * WCAG AA contrast for small badge text on the (lighter) soft backgrounds in
 * both modes.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    background: '#F7F8FA',
    card: '#FFFFFF',
    cardPressed: '#F1F5F9',
    raised: '#FFFFFF',
    elevated: '#FFFFFF',
    border: '#ECEFF3',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    primary: '#0A84FF',
    onPrimary: '#FFFFFF',
    primarySoft: '#E7F1FF',
    primaryStrong: '#0B63C4',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    successStrong: '#15803D',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    warningStrong: '#B45309',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
    dangerStrong: '#DC2626',
    neutralStrong: '#475569',
    star: '#F59E0B',
    input: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarBorder: '#ECEFF3',
  },
  dark: {
    background: '#0B0E14',
    card: '#151A23',
    cardPressed: '#1D2330',
    raised: '#1B2230',
    elevated: '#1B2230',
    border: '#232B3B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#3B9EFF',
    onPrimary: '#0B1220',
    primarySoft: '#12263D',
    primaryStrong: '#7DBEFF',
    success: '#34D399',
    successSoft: '#0B2E23',
    successStrong: '#4ADE80',
    warning: '#FBBF24',
    warningSoft: '#33260B',
    warningStrong: '#FCD34D',
    danger: '#F87171',
    dangerSoft: '#3A1616',
    dangerStrong: '#FCA5A5',
    neutralStrong: '#A9B4C6',
    star: '#FBBF24',
    input: '#151A23',
    tabBar: '#0F131B',
    tabBarBorder: '#232B3B',
  },
} as const;

export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Rounder, bolder corners. `card` (and its `sheet` alias) is the hero radius. */
export const Radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  /** Cards & sheets. */
  card: 20,
  sheet: 20,
  /** Buttons & inputs. */
  button: 14,
  input: 14,
  /** Fully-rounded pills / circles. */
  pill: 999,
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
  /** Standard screen horizontal padding. */
  screen: 20,
} as const;

/**
 * Type scale used everywhere. Platform system font (SF Pro on iOS, Roboto on
 * Android) — no custom font files. Spread a token into a Text style:
 *   <Text style={[Typography.h1, { color: colors.text }]} />
 */
export const Typography = {
  display: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 30, letterSpacing: -0.4 },
  h1: { fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700', lineHeight: 22, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  /** Uppercase section eyebrow — pair with letterSpacing 0.6. */
  eyebrow: { fontSize: 12, fontWeight: '700', lineHeight: 16, letterSpacing: 0.6 },
  stat: { fontSize: 28, fontWeight: '800', lineHeight: 32, letterSpacing: -0.5 },
} satisfies Record<string, TextStyle>;

/**
 * Soft, low card elevation. Minimal borders — cards use shadow instead of a
 * border in light mode; dark mode keeps a hairline border for separation.
 */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

/** Stronger elevation for floating elements (FAB). */
export const floatingShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0A84FF',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 8 },
  default: {},
}) as ViewStyle;
