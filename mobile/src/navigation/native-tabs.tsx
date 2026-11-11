import { Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { colors, fonts, textSize } from "@/ui/tokens";
import { TABS } from "./tabs";

/**
 * The system tab bar (UITabBarController on iOS, Material bottom navigation on Android), from
 * `expo-router/native-tabs`, the stable import path since SDK 58.
 *
 * Android, as mock-up 1 draws it: every tab keeps its label (Material hides the labels of
 * unselected tabs when there are more than three), and the selected icon sits on a red pill.
 */
export function NativeTabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.panel}
      tintColor={colors.fg}
      iconColor={{
        default: colors.muted,
        selected: Platform.OS === "android" ? colors.onRed : colors.accent,
      }}
      indicatorColor={colors.red}
      labelVisibilityMode="labeled"
      labelStyle={{
        default: { color: colors.muted, fontFamily: fonts.regular, fontSize: textSize[1] },
        selected: { color: colors.fg, fontFamily: fonts.medium, fontSize: textSize[1] },
      }}
      blurEffect="systemChromeMaterialDark"
    >
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
