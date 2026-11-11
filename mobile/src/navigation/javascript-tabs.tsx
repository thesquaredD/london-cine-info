import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { colors, fonts, textSize } from "@/ui/tokens";
import { TABS } from "./tabs";

/**
 * The fallback for native tabs: Expo Router's JavaScript tab bar over the same route folders,
 * with the same labels and symbols. Selected with `USE_NATIVE_TABS = false` in `tabs.ts`.
 */
export function JavaScriptTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.fg,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: textSize[1] },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, size }) => (
              <SymbolView
                name={{ ios: tab.sf, android: tab.md }}
                size={size}
                tintColor={focused ? colors.accent : colors.muted}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
