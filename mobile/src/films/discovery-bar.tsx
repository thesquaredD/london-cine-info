import { useCallback, useRef } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type HostInstance,
} from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import type { FilmView } from "@readograph/core/display";
import { Icon } from "@/ui/icon";
import { Text } from "@/ui/text";
import { colors, radius, space, touchTarget } from "@/ui/tokens";
import type { FilterChip } from "./chips";

/**
 * The Films screen's discovery controls (mock-up 1): the icon-only Filters button beside the
 * search field, the active-filter chips under it, and the results bar with the count, the sort
 * control and the List | Posters switch. Events and Radar reuse the button and the chips.
 */

/**
 * Icon only: filled curtain red with a brass count badge when any filter is active, outlined
 * otherwise, as on the website at 390px. It opens the tab's Filters sheet route, and when the
 * sheet closes the screen reader's focus comes back to it.
 */
export function FiltersButton({ count, href }: { count: number; href: Href }) {
  const ref = useRef<HostInstance>(null);
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!opened.current) return;
      opened.current = false;
      if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    }, []),
  );
  const active = count > 0;
  return (
    <Pressable
      ref={ref}
      onPress={() => {
        opened.current = true;
        router.push(href);
      }}
      accessibilityRole="button"
      accessibilityLabel={active ? `Filters, ${count} active` : "Filters"}
      style={({ pressed }) => [
        styles.filters,
        active ? styles.filtersActive : styles.filtersIdle,
        pressed && styles.pressed,
      ]}
    >
      <Icon name="filters" color={active ? colors.onRed : colors.fg} />
      {active ? (
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
          <Text size={1} weight="medium" tone="onBrass" style={styles.badgeText}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * One chip per active filter ("Today ×"), then Clear all. Absent when nothing is active, so the
 * row takes no height.
 */
export function FilterChips({
  chips,
  onApply,
  onClearAll,
}: {
  chips: FilterChip[];
  onApply: (changes: FilterChip["changes"]) => void;
  onClearAll: () => void;
}) {
  if (!chips.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chips}
      accessibilityLabel="Active filters"
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={() => onApply(chip.changes)}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter: ${chip.label}`}
          hitSlop={{ top: 6, bottom: 6 }}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text size={2}>{chip.label}</Text>
          <Text size={2} tone="muted" accessibilityElementsHidden importantForAccessibility="no">
            ×
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onClearAll}
        accessibilityRole="button"
        accessibilityLabel="Clear all filters"
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => [styles.clearAll, pressed && styles.pressed]}
      >
        <Text size={2} tone="brass">
          Clear all
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/** The two-button List | Posters switch at the right edge of the results bar. */
export function ViewSwitch({
  view,
  onChange,
}: {
  view: FilmView;
  onChange: (view: FilmView) => void;
}) {
  return (
    <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="Show films as">
      {(["list", "posters"] as const).map((option) => {
        const selected = option === view;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option === "list" ? "List" : "Posters"}
            hitSlop={4}
            style={[styles.switchButton, selected && styles.switchSelected]}
          >
            <Icon name={option} size={18} color={selected ? colors.fg : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** The results bar: the count, then the sort control and the view switch at the right edge. */
export function ResultsBar({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <View style={styles.results}>
      <Text tone="muted" style={styles.count} accessibilityLiveRegion="polite">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  filtersIdle: { borderWidth: 1, borderColor: colors.line },
  filtersActive: { backgroundColor: colors.red },
  pressed: { opacity: 0.8 },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brass,
  },
  badgeText: { lineHeight: 16 },
  chips: {
    gap: space.s,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: space.m,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  clearAll: { minHeight: 32, justifyContent: "center", paddingHorizontal: space.s },
  results: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    marginTop: space.s,
    minHeight: 48,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  count: { flex: 1 },
  switch: {
    flexDirection: "row",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  switchButton: {
    width: touchTarget,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  switchSelected: { backgroundColor: colors.shade },
});
