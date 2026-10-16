import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import { Providers } from "../src/providers";
import { useTokens } from "../src/ui";
export default function Layout() {
  const c = useTokens();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <BottomSheetModalProvider>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: c.panel },
                headerTintColor: c.fg,
                contentStyle: { backgroundColor: c.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="film/[id]" options={{ title: "Film" }} />
              <Stack.Screen
                name="account/sign-in"
                options={{ title: "Sign in", presentation: "modal" }}
              />
              <Stack.Screen
                name="account/cinemas"
                options={{ title: "My cinemas", presentation: "modal" }}
              />
            </Stack>
          </BottomSheetModalProvider>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
