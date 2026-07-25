import { Colors, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/providers/theme-preference';

export function useTheme(): { colors: Theme; isDark: boolean } {
  const systemScheme = useColorScheme();
  const { preference } = useThemePreference();

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
