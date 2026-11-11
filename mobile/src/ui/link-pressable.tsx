import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

export type LinkPressableProps = Omit<PressableProps, "style"> & {
  /** One style object (a `StyleSheet` entry or an inline object), not an array or a function. */
  style?: ViewStyle;
  /** Added on top of `style` while the finger is down. */
  pressedStyle?: StyleProp<ViewStyle>;
};

/**
 * The pressable child of an Expo Router `<Link asChild>`.
 *
 * `asChild` renders Radix's `Slot`, which merges the link's props into its child and merges
 * `style` as `{ ...linkStyle, ...childStyle }`. A `Pressable` function style
 * (`style={({ pressed }) => …}`) spreads to `{}` there, so every layout style on the row was
 * dropped. Expo Router also rejects an array style on a Slot child in development. This
 * component takes the style as one object, which survives the merge, and applies the pressed
 * state itself.
 */
export function LinkPressable({ style, pressedStyle, ...rest }: LinkPressableProps) {
  return <Pressable {...rest} style={({ pressed }) => [style, pressed && pressedStyle]} />;
}
