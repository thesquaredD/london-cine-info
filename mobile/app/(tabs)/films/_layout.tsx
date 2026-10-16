import { Stack } from "expo-router";
import { useTokens } from "../../../src/ui";
export default function Layout() {
  const c = useTokens();
  return (
    <Stack
      screenOptions={{
        title: "Films",
        headerStyle: { backgroundColor: c.panel },
        headerTintColor: c.fg,
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}
