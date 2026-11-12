import { SheetTextInput } from "@/ui/sheet-components";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { colors, fonts, radius, space, textSize, touchTarget } from "@/ui/tokens";

/**
 * The search field under the collection switcher, as in mock-up 1, with the icon-only Filters
 * button beside it; the Filters sheet reuses it with its own placeholder. Typing updates the list after a short pause so a 1,500-film
 * catalogue is not re-filtered on every keystroke.
 */
export function SearchField({
  value,
  onChange,
  placeholder = "What do you want to see?",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 150);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <View style={styles.field}>
      <Text tone="muted" accessibilityElementsHidden importantForAccessibility="no">
        ⌕
      </Text>
      <SheetTextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search films, original titles and directors"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        selectionColor={colors.brass}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s,
    minHeight: touchTarget,
    paddingHorizontal: 14,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space.s,
    minHeight: touchTarget,
    color: colors.fg,
    fontFamily: fonts.regular,
    fontSize: textSize[3],
  },
});
