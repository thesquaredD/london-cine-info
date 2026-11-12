import { Platform } from "react-native";
import { Stack } from "expo-router";
import { ViewScope, type ViewScopeName } from "@/films/view-context";
import { headerOptions } from "@/ui/header";
import { colors } from "@/ui/tokens";
import { Wordmark } from "@/ui/wordmark";

/**
 * The stack of a list tab (Films, Events, Radar): the list with the wordmark as its title, the
 * film detail pushed over it, and the Filters sheet presented over both.
 *
 * iOS uses a native formSheet route. Android's toolbar presents a BottomSheetModal above the
 * tabs (AndroidFiltersProvider); the filters route only forwards deep links to that modal.
 */
export function ListStack({ scope }: { scope: ViewScopeName }) {
  return (
    <ViewScope name={scope}>
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="index" options={{ headerTitle: () => <Wordmark /> }} />
        {/* The list's title is the wordmark image, so the back button needs its own label. */}
        <Stack.Screen
          name="[id]"
          options={{
            title: "",
            headerBackTitle: scope === "films" ? "Films" : scope === "events" ? "Events" : "Radar",
          }}
        />
        <Stack.Screen
          name="filters"
          options={
            Platform.OS === "ios"
              ? {
                  presentation: "formSheet",
                  headerShown: false,
                  sheetAllowedDetents: [1],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 12,
                  contentStyle: { backgroundColor: colors.panel },
                }
              : { headerShown: false, animation: "none" }
          }
        />
      </Stack>
    </ViewScope>
  );
}
