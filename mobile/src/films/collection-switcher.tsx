import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/ui/text";
import { colors, space, touchTarget } from "@/ui/tokens";
import { COLLECTIONS } from "./view-store";

/**
 * The collection switcher: a scrolling row under the header (plan, open points: a chip row
 * rather than a native title menu), drawn as in mock-up 1 with a brass underline on the
 * current collection.
 */
export function CollectionSwitcher({
  path,
  onChange,
}: {
  path: string;
  onChange: (path: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bar}
      accessibilityRole="tablist"
      accessibilityLabel="Collections"
    >
      {COLLECTIONS.map((collection) => {
        const selected = collection.path === path;
        return (
          <Pressable
            key={collection.path}
            onPress={() => onChange(collection.path)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.item, selected && styles.selected]}
          >
            <Text tone={selected ? "fg" : "muted"}>{collection.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
  },
  row: { gap: space.xl, paddingHorizontal: space.l },
  item: {
    minHeight: touchTarget,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: colors.brass },
});
