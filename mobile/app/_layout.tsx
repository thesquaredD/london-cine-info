import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CatalogueProvider } from "@/catalogue/provider";
import { FilmsViewProvider } from "@/films/view-context";
import { colors } from "@/ui/tokens";

/** Providers and the root native stack. The tabs are one screen of this stack. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CatalogueProvider>
        <FilmsViewProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
        </FilmsViewProvider>
      </CatalogueProvider>
    </SafeAreaProvider>
  );
}
