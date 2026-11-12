import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "./text";
import { colors, radius, space, touchTarget } from "./tokens";

/**
 * A row of mutually exclusive choices (Radar's sections, the Events views, the film gauge), as
 * the website's pressed-button groups. It scrolls sideways if the labels outgrow the screen.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  /** Null when none of the options describes the current state. */
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              size={2}
              weight={selected ? "medium" : "regular"}
              tone={selected ? "onRed" : "fg"}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.s, paddingHorizontal: space.l, paddingTop: space.m },
  option: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    justifyContent: "center",
    paddingHorizontal: space.m,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  selected: { backgroundColor: colors.red },
  pressed: { opacity: 0.8 },
});
