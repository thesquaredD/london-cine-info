import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { colors, radius, space, touchTarget } from "./tokens";

/** A short message with an optional action, for loading, empty and error states. */
export function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text size={4} weight="medium">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A one-line banner above a list, such as "Update the app to see new listings." */
export function Banner({ children }: { children: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text size={2}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.xl, gap: space.s, alignItems: "flex-start" },
  body: { maxWidth: 480 },
  button: {
    marginTop: space.s,
    minHeight: touchTarget,
    paddingHorizontal: space.l,
    justifyContent: "center",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { backgroundColor: colors.shade },
  banner: {
    marginHorizontal: space.l,
    marginTop: space.m,
    padding: space.m,
    borderRadius: radius,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.brassRuleSoft,
  },
});
