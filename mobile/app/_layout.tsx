import { enableLegacyHeaderAppearance, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CatalogueProvider } from "@/catalogue/provider";
import { ViewStoresProvider } from "@/films/view-context";
import { colors } from "@/ui/tokens";

// Expo Router 58 makes native stack headers transparent on iOS 26 and later, with the content
// drawn underneath and the system's fonts. The approved design has an opaque header in the
// masthead red, so the app keeps the earlier appearance (docs/mobile.md, "Navigation").
enableLegacyHeaderAppearance();

/** Providers and the root native stack. The tabs are one screen of this stack. */
export default function RootLayout() {
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
