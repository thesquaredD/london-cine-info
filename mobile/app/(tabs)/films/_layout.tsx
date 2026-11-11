import { Stack } from "expo-router";
import { headerOptions } from "@/ui/header";
import { Wordmark } from "@/ui/wordmark";

/**
 * The Films stack: the list, and the film detail pushed over it. PR 5 adds
 * `filters.tsx` here as a `formSheet` route.
 */
export default function FilmsLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ headerTitle: () => <Wordmark /> }} />
      {/* The list's title is the wordmark image, so the back button needs its own label. */}
      <Stack.Screen name="[id]" options={{ title: "", headerBackTitle: "Films" }} />
    </Stack>
  );
}
