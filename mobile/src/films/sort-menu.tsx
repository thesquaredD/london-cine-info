import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sortLabel, type SortKey, type ViewState } from "@readograph/core/catalogue";
import { Text } from "@/ui/text";
import { colors, radius, space, touchTarget } from "@/ui/tokens";
import { SORT_KEYS } from "./view-store";

const directionLabel = (state: Pick<ViewState, "sort" | "direction">) => {
  const [first, second] =
    state.sort === "runtime"
      ? ["Shortest first", "Longest first"]
      : state.sort === "year"
        ? ["Oldest first", "Newest first"]
        : state.sort === "title" || state.sort === "director"
          ? ["A–Z", "Z–A"]
          : ["Lowest first", "Highest first"];
  return state.direction === "asc" ? first : second;
};

/**
 * The sort control in the results bar: the current key as icon plus value (as on the website at
 * 390px), opening a list of keys. Choosing the current key again flips its direction, a third
 * time returns to the collection's default, the website's `nextSort` rule.
 */
export function SortMenu({
  state,
  onSort,
  keys = SORT_KEYS,
}: {
  state: ViewState;
  onSort: (key: SortKey) => void;
  keys?: readonly SortKey[];
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = sortLabel(state.sort);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${current}, ${directionLabel(state)}`}
        hitSlop={8}
        style={styles.trigger}
      >
        <Text accessibilityElementsHidden importantForAccessibility="no">
          ⇅
        </Text>
        <Text>{current}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close sort"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.m }]}
          accessibilityViewIsModal
        >
          <Text size={4} weight="medium" accessibilityRole="header" style={styles.heading}>
            Sort
          </Text>
          {keys.map((key) => {
            const selected = key === state.sort;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  onSort(key);
                  if (!selected) setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text weight={selected ? "medium" : "regular"}>{sortLabel(key)}</Text>
                {selected ? <Text tone="brass">{directionLabel(state)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: touchTarget },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius * 3,
    borderTopRightRadius: radius * 3,
    paddingTop: space.l,
    paddingHorizontal: space.l,
  },
  heading: { marginBottom: space.s },
  option: {
    minHeight: touchTarget + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
  },
  pressed: { backgroundColor: colors.shade },
});
