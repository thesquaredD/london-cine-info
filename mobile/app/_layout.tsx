import { useFonts } from "expo-font";
import { enableLegacyHeaderAppearance, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CatalogueProvider } from "@/catalogue/provider";
import { ViewStoresProvider } from "@/films/view-context";
import { colors, fonts } from "@/ui/tokens";

// Expo Router 58 makes native stack headers transparent on iOS 26 and later, with the content
// drawn underneath and the system's fonts. The approved design has an opaque header in the
// masthead red, so the app keeps the earlier appearance (docs/mobile.md, "Navigation").
enableLegacyHeaderAppearance();

// League Spartan is embedded by the expo-font config plugin in builds, but Expo Go ignores config
// plugins, so it is also loaded at start. In a build the fonts are already there and this
// resolves at once.
/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves font requires to asset IDs. */
const leagueSpartan = {
  [fonts.regular]: require("../assets/fonts/LeagueSpartan-Regular.ttf") as number,
  [fonts.medium]: require("../assets/fonts/LeagueSpartan-Medium.ttf") as number,
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Providers and the root native stack. The tabs are one screen of this stack. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(leagueSpartan);
  // Draw nothing (the splash screen stays up) until the fonts load; a failed load falls back to
  // the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <CatalogueProvider>
        <ViewStoresProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ViewStoresProvider>
      </CatalogueProvider>
    </SafeAreaProvider>
  );
}
