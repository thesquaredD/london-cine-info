import { DateCalendar } from "./date-calendar";
import { SheetTextInput } from "@/ui/sheet-components";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import type { DataMeta, FacetKey } from "@readograph/core/data";
import { Icon, type IconName } from "@/ui/icon";
import { Text } from "@/ui/text";
import { colors, fonts, radius, space, textSize, touchTarget } from "@/ui/tokens";
import { facetOptions, facetSummary, toggleOption, type FacetOption } from "./facets";

const NO_COUNTS = new Map<string, number>();

/**
 * One row of the Filters sheet (the website's FilterPicker): a line icon, the facet's name and
 * a summary of its choice. Tapping it opens the options: "Exclude options" and "Clear", a find
 * field for long lists, then each option with its count. A tap includes an option; in exclude
 * mode it excludes it ("NOT"); a second tap clears it.
 */
export function FacetSection({
  facet,
  label,
  icon,
  meta,
  selected,
  excluded,
  countsFor,
  summaryValue,
  before,
  after,
  onChange,
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
  facet: FacetKey;
  label: string;
  icon: IconName;
  meta: DataMeta;
  selected: string[];
  excluded: string[];
  /** The option counts for a facet; called only while this section is open. */
  countsFor: (facet: FacetKey) => Map<string, number>;
  summaryValue?: string;
  before?: ReactNode;
  after?: ReactNode;
  onChange: (selected: string[], excluded: string[]) => void;
}) {
  const [excludeMode, setExcludeMode] = useState(false);
  const [find, setFind] = useState("");
  // Closed rows need only summaries. Day mounts one month instead of formatting every date.
  const options = useMemo(
    () => (open && facet !== "day" ? facetOptions(facet, meta) : []),
    [open, facet, meta],
  );
  const searchable = facet !== "day" && options.length > 8;
  const groups = useMemo(() => (open ? facetGroups(options, find) : []), [open, options, find]);
  const counts = useMemo(() => (open ? countsFor(facet) : NO_COUNTS), [open, countsFor, facet]);
  const summary = facetSummary(facet, label, selected, excluded, meta, summaryValue);
  const active = selected.length > 0 || excluded.length > 0 || !!summaryValue;
  return (
    <View style={styles.section}>
      {!open ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${summary}`}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        >
          <Icon name={icon} color={active ? colors.brass : colors.muted} />
          <Text style={styles.label}>{label}</Text>
          <Text size={2} tone={active ? "brass" : "muted"} numberOfLines={1} style={styles.summary}>
            {summary}
          </Text>
          <Text tone="muted" accessibilityElementsHidden importantForAccessibility="no">
            ›
          </Text>
        </Pressable>
      ) : null}
      {open ? (
        <View style={styles.body}>
          {before}
          {searchable ? (
            <SheetTextInput
              value={find}
              onChangeText={setFind}
              placeholder={`Find ${label.toLowerCase()}…`}
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Find ${label.toLowerCase()}`}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              selectionColor={colors.brass}
              style={styles.find}
            />
          ) : null}
          <View style={styles.actions}>
            <Pressable
              onPress={() => setExcludeMode(!excludeMode)}
              accessibilityRole="switch"
              accessibilityState={{ checked: excludeMode }}
              style={[styles.action, excludeMode && styles.actionOn]}
            >
              <Text size={2}>Exclude options</Text>
            </Pressable>
            <Pressable
              onPress={() => onChange([], [])}
              disabled={!selected.length && !excluded.length}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected.length && !excluded.length }}
              style={[styles.action, !selected.length && !excluded.length && styles.disabled]}
            >
              <Text size={2}>Clear {label.toLowerCase()}</Text>
            </Pressable>
          </View>
          {facet === "day" ? (
            <DateCalendar
              selected={selected}
              excluded={excluded}
              counts={counts}
              excludeMode={excludeMode}
              meta={meta}
              onChange={onChange}
            />
          ) : (
            groups.map(([group, items]) => (
              <View key={group || "all"}>
                {group ? (
                  <Text size={1} tone="muted" style={styles.group}>
                    {group.toUpperCase()}
                  </Text>
                ) : null}
                {items.map((option) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    count={counts.get(option.id) ?? 0}
                    showCount={!option.quick}
                    state={
                      excluded.includes(option.id)
                        ? "excluded"
                        : selected.includes(option.id)
                          ? "selected"
                          : "off"
                    }
                    onPress={() => {
                      const next = toggleOption(selected, excluded, option.id, excludeMode);
                      onChange(next.selected, next.excluded);
                    }}
                  />
                ))}
              </View>
            ))
          )}
          {facet !== "day" && !groups.length ? (
            <Text tone="muted" style={styles.none}>
              No options match “{find}”.
            </Text>
          ) : null}
          {after}
        </View>
      ) : null}
    </View>
  );
}

function facetGroups(options: FacetOption[], find: string): [string, FacetOption[]][] {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const term = normalize(find.trim());
  const grouped = new Map<string, FacetOption[]>();
  for (const option of options) {
    if (term && !normalize(`${option.label} ${option.id}`).includes(term)) continue;
    grouped.set(option.group, [...(grouped.get(option.group) ?? []), option]);
  }
  return [...grouped];
}

function OptionRow({
  option,
  count,
  showCount,
  state,
  onPress,
}: {
  option: FacetOption;
  count: number;
  showCount: boolean;
  state: "off" | "selected" | "excluded";
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === "excluded" ? "mixed" : state === "selected" }}
      accessibilityLabel={`${state === "excluded" ? "Not " : ""}${option.label}${showCount ? `, ${count}` : ""}`}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.box,
          state === "selected" && styles.boxOn,
          state === "excluded" && styles.boxNot,
        ]}
      >
        {state === "selected" ? <Icon name="check" size={14} color={colors.onRed} /> : null}
        {state === "excluded" ? (
          <Text size={1} weight="medium" tone="onRed">
            –
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.optionLabel, showCount && count === 0 && state === "off" && styles.zero]}
        numberOfLines={2}
      >
        {state === "excluded" ? (
          <Text weight="medium" tone="soldOut">
            NOT{" "}
          </Text>
        ) : null}
        {option.label}
      </Text>
      {showCount ? (
        <Text size={2} tone="muted">
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A switch row: "Hide sold-out screenings", "Under 2 hours", "Independent cinemas only". */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text>{label}</Text>
        {hint ? (
          <Text size={2} tone="muted" style={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.shade, true: colors.red }}
        thumbColor={colors.fg}
        ios_backgroundColor={colors.shade}
      />
    </View>
  );
}

/** A short explanatory line inside a facet, as the website's `.filter-hint`. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <Text size={2} tone="muted" style={styles.hintBlock}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rowLine },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: 52,
    paddingHorizontal: space.l,
  },
  pressed: { backgroundColor: colors.shade },
  label: { flexShrink: 0 },
  summary: { flex: 1, textAlign: "right" },
  body: { paddingHorizontal: space.l, paddingBottom: space.m },
  find: {
    minHeight: 48,
    marginBottom: space.s,
    paddingHorizontal: space.m,
    borderRadius: radius,
    backgroundColor: colors.shade,
    color: colors.fg,
    fontFamily: fonts.regular,
    fontSize: textSize[3],
  },
  actions: { flexDirection: "row", gap: space.s, marginBottom: space.s },
  action: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: space.m,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionOn: { backgroundColor: colors.shade, borderColor: colors.brass },
  disabled: { opacity: 0.5 },
  group: { marginTop: space.m, marginBottom: space.xs, letterSpacing: 0.5 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: Math.max(48, touchTarget),
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.red, borderColor: colors.red },
  boxNot: { backgroundColor: colors.shade, borderColor: colors.soldOut },
  optionLabel: { flex: 1 },
  zero: { color: colors.muted },
  none: { paddingVertical: space.m },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: 52,
    paddingVertical: space.s,
  },
  toggleText: { flex: 1 },
  hint: { marginTop: 2 },
  hintBlock: { marginBottom: space.s },
});
