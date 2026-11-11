import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { colors } from "./tokens";

/**
 * Line icons from the platform's own sets: SF Symbols on iOS, Material Symbols on Android
 * (expo-symbols, already used by the tabs). The website draws its own SVG line icons; the app
 * uses the system's so they sit at the system's weight. Icons are decorative: the control next
 * to them carries the label.
 */
const ICONS = {
  filters: { ios: "slider.horizontal.3", android: "tune" },
  day: { ios: "calendar", android: "calendar_today" },
  time: { ios: "clock", android: "schedule" },
  venue: { ios: "film", android: "theaters" },
  borough: { ios: "mappin.and.ellipse", android: "location_on" },
  membership: { ios: "creditcard", android: "card_membership" },
  genre: { ios: "tag", android: "sell" },
  format: { ios: "film.stack", android: "movie" },
  language: { ios: "globe", android: "language" },
  year: { ios: "hourglass", android: "hourglass_empty" },
  accessibility: { ios: "accessibility", android: "accessibility" },
  nearby: { ios: "location", android: "near_me" },
  list: { ios: "list.bullet", android: "view_list" },
  posters: { ios: "square.grid.3x3", android: "grid_view" },
  close: { ios: "xmark", android: "close" },
  sort: { ios: "arrow.up.arrow.down", android: "swap_vert" },
  check: { ios: "checkmark", android: "check" },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = colors.fg,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      weight="regular"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    />
  );
}
