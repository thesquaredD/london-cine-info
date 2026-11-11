import { Stack } from "expo-router";
import { ViewScope, type ViewScopeName } from "@/films/view-context";
import { headerOptions } from "@/ui/header";
import { colors } from "@/ui/tokens";
import { Wordmark } from "@/ui/wordmark";

/**
 * The stack of a list tab (Films, Events, Radar): the list with the wordmark as its title, the
 * film detail pushed over it, and the Filters sheet presented over both.
 *
 * The sheet is a `formSheet` route (plan: "The Filters drawer"): `UISheetPresentationController`
 * on iOS, the Material bottom sheet on Android. One detent, the tall sheet with the list's
 * header still visible behind it; the grabber shows; corners are 12. Because the sheet is a
 * route in this stack, Android back pops it before it can leave the tab.
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
          options={{
            presentation: "formSheet",
            headerShown: false,
            sheetAllowedDetents: [1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 12,
            contentStyle: { backgroundColor: colors.panel },
          }}
        />
      </Stack>
    </ViewScope>
  );
}
