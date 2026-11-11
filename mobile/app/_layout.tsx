import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CatalogueProvider } from "@/catalogue/provider";
import { ViewStoresProvider } from "@/films/view-context";
import { colors } from "@/ui/tokens";

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
