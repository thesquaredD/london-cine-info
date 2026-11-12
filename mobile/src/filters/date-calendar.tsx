import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { DataMeta } from "@readograph/core/data";
import { londonDate } from "@readograph/core/filters";
import { useNow } from "@/films/use-now";
import { Text } from "@/ui/text";
import { colors, radius, space } from "@/ui/tokens";
import { adjacentMonth, monthCells, toggleDate } from "./calendar";

const QUICK = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "Weekend" },
  { id: "this-week", label: "Week" },
];
const monthName = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});
const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" });
const minimum = Platform.OS === "ios" ? 44 : 48;

/** One month, never a long future-date list. Counts come from this tab's correlated matcher. */
export function DateCalendar({
  selected,
  excluded,
  counts,
  excludeMode,
  meta,
  onChange,
}: {
  selected: string[];
  excluded: string[];
  counts: Map<string, number>;
  excludeMode: boolean;
  meta: DataMeta;
  onChange: (selected: string[], excluded: string[]) => void;
}) {
  const today = londonDate(useNow());
  const [month, setMonth] = useState(() =>
    (selected.find((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)) ?? today).slice(0, 7),
  );
  const cells = useMemo(() => monthCells(month), [month]);
  const pick = (id: string) => {
    const next = toggleDate(selected, excluded, id, excludeMode);
    onChange(next.selected, next.excluded);
  };
  return (
    <View style={styles.calendar}>
      <View style={styles.shortcuts}>
        {QUICK.map(({ id, label }) => (
          <Pressable
            key={id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${excluded.includes(id) ? "Not " : ""}${label}`}
            accessibilityState={{
              checked: excluded.includes(id) ? "mixed" : selected.includes(id),
            }}
            onPress={() => pick(id)}
            style={({ pressed }) => [
              styles.shortcut,
              selected.includes(id) && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              size={2}
              style={[
                selected.includes(id) && styles.selectedText,
                excluded.includes(id) && styles.excluded,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.heading}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth(adjacentMonth(month, -1))}
          style={styles.arrow}
        >
          <Text size={6}>‹</Text>
        </Pressable>
        <Text
          size={4}
          weight="medium"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.month}
        >
          {monthName.format(new Date(`${month}-01T12:00:00Z`))}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setMonth(adjacentMonth(month, 1))}
          style={styles.arrow}
        >
          <Text size={6}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <View key={day} style={styles.cell}>
            <Text size={1} tone="muted" accessibilityElementsHidden importantForAccessibility="no">
              {day}
            </Text>
          </View>
        ))}
        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.cell} />;
          const included = selected.includes(date);
          const rejected = excluded.includes(date);
          const count = counts.get(date) ?? 0;
          const disabled = !count && !included && !rejected;
          return (
            <Pressable
              key={date}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rejected ? "mixed" : included, disabled }}
              accessibilityLabel={`${fullDate.format(new Date(`${date}T12:00:00Z`))}, ${count} matching results${rejected ? ", excluded" : ""}${date === today ? ", today" : ""}`}
              onPress={() => pick(date)}
              style={({ pressed }) => [
                styles.cell,
                included && styles.selected,
                date === today && styles.today,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  disabled && styles.disabled,
                  included && styles.selectedText,
                  rejected && styles.excluded,
                ]}
              >
                {Number(date.slice(8))}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text size={2} tone="muted" style={styles.hint}>
        Listed dates: {meta.facets.day[0]?.id ?? "unknown"}–
        {meta.facets.day.at(-1)?.id ?? "unknown"}. Faded dates have no matching listings. Cinema
        programmes may be incomplete.
      </Text>
      <Text size={2} tone="muted" style={styles.hint}>
        Selected dates are highlighted. Crossed-out dates are excluded. Use Exclude options to omit
        dates.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  calendar: { marginHorizontal: -space.xs },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginBottom: space.m },
  shortcut: {
    minHeight: minimum,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.s,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  heading: { flexDirection: "row", alignItems: "center", marginBottom: space.xs },
  arrow: { minHeight: minimum, minWidth: minimum, justifyContent: "center", alignItems: "center" },
  month: { flex: 1, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    minHeight: minimum,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius,
  },
  selected: { backgroundColor: colors.fg },
  selectedText: { color: colors.bg },
  today: { borderWidth: 1, borderColor: colors.brass },
  excluded: { color: colors.soldOut, textDecorationLine: "line-through" },
  disabled: { color: colors.muted, opacity: 0.4 },
  pressed: { opacity: 0.7 },
  hint: { marginTop: space.m },
});
