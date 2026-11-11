import type { AndroidSymbol, SFSymbol } from "expo-symbols";

/**
 * The five tabs, shared by the native tabs and the JavaScript fallback so the two cannot
 * drift. `name` is the route folder under `app/(tabs)/`.
 *
 * The switch: `USE_NATIVE_TABS`. Native tabs (`expo-router/native-tabs`) are stable since
 * SDK 58; if the device checks still find them unreliable, set it to false and the same route
 * files render in Expo Router's JavaScript `Tabs` (docs/mobile.md, "Tabs fallback").
 */
export const USE_NATIVE_TABS = true;

export type TabDefinition = { name: string; label: string; sf: SFSymbol; md: AndroidSymbol };

export const TABS: readonly TabDefinition[] = [
  { name: "films", label: "Films", sf: "film", md: "movie" },
  { name: "events", label: "Events", sf: "ticket", md: "confirmation_number" },
  { name: "radar", label: "Radar", sf: "scope", md: "radar" },
  { name: "mine", label: "My films", sf: "bookmark", md: "bookmark" },
  { name: "account", label: "Account", sf: "person.crop.circle", md: "account_circle" },
];
