import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { colors, fonts, textSize } from "./tokens";

/**
 * The native stack header in the masthead's curtain red, shared by every tab's stack. The
 * header stays native so the push, the back button and the iOS swipe back are the system's.
 */
type StackOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack>["screenOptions"]>,
  (...args: never[]) => unknown
>;

export const headerOptions: StackOptions = {
  headerStyle: { backgroundColor: colors.red },
  headerTintColor: colors.onRed,
  headerTitleStyle: { fontFamily: fonts.medium, fontSize: textSize[4], color: colors.onRed },
  headerBackTitleStyle: { fontFamily: fonts.regular, fontSize: textSize[4] },
  headerShadowVisible: false,
  headerTitleAlign: "center",
  contentStyle: { backgroundColor: colors.bg },
};
