import { Colors, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): { colors: Theme; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
