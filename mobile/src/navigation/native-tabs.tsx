import { NativeTabs } from "expo-router/native-tabs";
import { colors, fonts, textSize } from "@/ui/tokens";
import { TABS } from "./tabs";

/**
 * The system tab bar (UITabBarController on iOS, Material bottom navigation on Android), from
 * `expo-router/native-tabs`, the stable import path since SDK 58.
 */
export function NativeTabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.panel}
      tintColor={colors.fg}
      iconColor={{ default: colors.muted, selected: colors.accent }}
      indicatorColor={colors.shade}
      labelStyle={{
        default: { color: colors.muted, fontFamily: fonts.regular, fontSize: textSize[1] },
        selected: { color: colors.fg, fontFamily: fonts.regular, fontSize: textSize[1] },
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
