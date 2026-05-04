import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

type Palette = typeof colors.light & { radius: number };

export function useColors(): Palette {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
