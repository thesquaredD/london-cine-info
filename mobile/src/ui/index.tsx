import type { PropsWithChildren, ReactNode } from "react";
import {
  Text as NativeText,
  View,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { useTokens, type as typography, space } from "./tokens";
export { useTokens } from "./tokens";
export function Text({
  tone = "body",
  muted,
  style,
  ...props
}: TextProps & { tone?: keyof typeof typography; muted?: boolean }) {
  const c = useTokens();
  return (
    <NativeText
      {...props}
      style={[
        typography[tone],
        {
          color: muted ? c.muted : c.fg,
          fontWeight: tone === "heading" || tone === "title" ? "500" : "400",
        },
        style,
      ]}
    />
  );
}
export function Button({
  label,
  onPress,
  selected,
  disabled,
  destructive,
}: {
  label: string;
  onPress(): void;
  selected?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const c = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: selected ? c.active : c.shade,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ color: selected ? c.onActive : destructive ? c.error : c.fg }}>{label}</Text>
    </Pressable>
  );
}
export const Chip = Button;
export function Row({ children }: PropsWithChildren) {
  return <View style={styles.row}>{children}</View>;
}
export function Input(props: TextInputProps) {
  const c = useTokens();
  return (
    <TextInput
      {...props}
      placeholderTextColor={c.muted}
      style={[
        styles.input,
        typography.body,
        { color: c.fg, backgroundColor: c.shade },
        props.style,
      ]}
    />
  );
}
export function Notice({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const c = useTokens();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: c.panel, borderLeftColor: c.brass }]}
    >
      <Text tone="heading">{title}</Text>
      {children ? <Text>{children}</Text> : null}
      {actions ? <Row>{actions}</Row> : null}
    </View>
  );
}
export function Page({ children }: PropsWithChildren) {
  const c = useTokens();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}
export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  const c = useTokens();
  return (
    <View style={[styles.section, { borderTopColor: c.line }]}>
      <Text tone="heading">{title}</Text>
      {children}
    </View>
  );
}
export function Footer({ children }: PropsWithChildren) {
  const c = useTokens();
  return <View style={[styles.footer, { borderTopColor: c.line }]}>{children}</View>;
}
export const styles = StyleSheet.create({
  page: { padding: space.inset, paddingBottom: space.section, gap: space.gap },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.small },
  button: {
    minHeight: 44,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  input: { minHeight: 48, borderRadius: 2, paddingHorizontal: 12, paddingVertical: 10 },
  notice: { padding: space.inset, borderLeftWidth: 3, gap: space.gap },
  section: {
    marginTop: space.section - space.gap,
    paddingTop: space.inset,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.gap,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.inset, gap: space.gap },
});
