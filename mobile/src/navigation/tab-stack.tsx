import { Stack } from "expo-router";
import { headerOptions } from "@/ui/header";
import { Wordmark } from "@/ui/wordmark";

/**
 * Each tab is its own native stack, so a pushed screen (the film detail) keeps the tab bar and
 * Back returns within the tab. The stack's first screen shows the wordmark as its title.
 */
export function TabStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ headerTitle: () => <Wordmark /> }} />
    </Stack>
  );
}
