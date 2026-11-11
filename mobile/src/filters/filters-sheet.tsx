import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ViewState } from "@readograph/core/catalogue";
import type { FacetKey } from "@readograph/core/data";
import { clearFilters, FILTERS } from "@readograph/core/filters";
import { shortcutItems, type ShortcutItem } from "@readograph/core/shortcuts";
import { toggleDecade } from "@readograph/core/years";
import { useCatalogue } from "@/catalogue/provider";
import { SearchField } from "@/films/search-field";
import { useNow } from "@/films/use-now";
import { useView, useViewStore } from "@/films/view-context";
import { NearMePanel } from "@/nearby/near-me-panel";
import type { IconName } from "@/ui/icon";
import { Text } from "@/ui/text";
import { colors, radius, space, touchTarget } from "@/ui/tokens";
import { FacetSection, Hint, ToggleRow } from "./facet-section";
import { decadeCounts, optionCounts, resultCount, resultLabel, type ScopeKind } from "./results";

/**
 * The Filters sheet (plan: "The Filters drawer"), the content of each list tab's `filters`
 * form-sheet route. It owns no filter state: every change writes straight to the tab's
 * `ViewState` store, so the list behind updates while the sheet is open and the count in the
 * heading is the list's live count. Closing commits nothing.
 *
 * Top to bottom, as the website's sheet at 390px: the quick filters from `shortcutItems` in
 * capitals, search, the When, Where and What groups with every facet, counts and exclusions,
 * the Only show toggles, then a footer bar with Reset all and Show N films.
 */
export function FiltersSheet({ kind }: { kind: ScopeKind }) {
  const { catalogue } = useCatalogue();
  const store = useViewStore();
  const state = useView();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const heading = useRef<View>(null);
  const [panel, setPanel] = useState<"filters" | "nearby">("filters");

  // VoiceOver and TalkBack start on the heading; the native sheet already hides the content
  // behind it from them.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(heading.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);

  // Android back inside Near me returns to the filters; otherwise the stack pops the sheet.
  useEffect(() => {
    if (panel !== "nearby") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPanel("filters");
      return true;
    });
    return () => subscription.remove();
  }, [panel]);

  const change = (changes: Partial<ViewState>) => store.update({ ...changes, page: 1 });
  const close = () => {
    if (router.canGoBack()) router.back();
  };

  const count = useMemo(
    () => (catalogue ? resultCount(kind, catalogue, state, now) : 0),
    [kind, catalogue, state, now],
  );
  // The option counts are the heaviest work in the sheet; React may finish them after the tap
  // has already updated the list and the heading count.
  const deferred = useDeferredValue(state);
  const counts = useMemo(
    () => (catalogue ? optionCounts(kind, catalogue, deferred, now) : null),
    [kind, catalogue, deferred, now],
  );
  const decades = useMemo(
    () => (catalogue ? decadeCounts(kind, catalogue, deferred, now) : []),
    [kind, catalogue, deferred, now],
  );
  // Accounts arrive in PR 6: until then MY WATCHLIST and MY CINEMAS are left out, exactly as
  // `shortcutItems` leaves them out for a signed-out reader with no saved cinemas.
  const shortcuts = useMemo(
    () =>
      shortcutItems({
        account: { user: null, watchlist: null },
        cinemas: { venues: [], loading: false },
        state,
        counts,
      }),
    [state, counts],
  );

  if (panel === "nearby" && catalogue)
    return (
      <NearMePanel
        headingRef={heading}
        meta={catalogue.meta}
        events={kind === "events"}
        onBack={() => setPanel("filters")}
        onApply={(changes) => {
          change(changes);
          close();
        }}
      />
    );

  const label = (key: FacetKey) => FILTERS.find((item) => item.key === key)!.label;
  const facet = (
    key: FacetKey,
    icon: IconName,
    extra?: Partial<Parameters<typeof FacetSection>[0]>,
  ) =>
    catalogue ? (
      <FacetSection
        key={key}
        facet={key}
        label={label(key)}
        icon={icon}
        meta={catalogue.meta}
        selected={state.filters[key] ?? []}
        excluded={state.excluded[key] ?? []}
        counts={counts?.[key] ?? new Map()}
        onChange={(selected, excluded) =>
          change({
            filters: { ...state.filters, [key]: selected },
            excluded: { ...state.excluded, [key]: excluded },
            ...(key === "venue" ? { myCinemas: false } : {}),
          })
        }
        {...extra}
      />
    ) : null;

  return (
    <View style={styles.sheet}>
      <View style={styles.heading}>
        <View ref={heading} accessible accessibilityRole="header" style={styles.title}>
          <Text size={5} weight="medium">
            Filters
          </Text>
          <Text size={2} tone="muted" accessibilityLiveRegion="polite">
            {resultLabel(kind, count)}
          </Text>
        </View>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          hitSlop={8}
          style={styles.close}
        >
          <Text size={6} accessibilityElementsHidden importantForAccessibility="no">
            ×
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <QuickFilters
          items={shortcuts}
          onToggle={(item) => item.changes && change(item.changes)}
          onNearby={() => setPanel("nearby")}
        />
        <View style={styles.search}>
          <SearchField
            value={state.search}
            onChange={(search) => change({ search })}
            placeholder="Film or director"
          />
        </View>

        <Group title="When">
          {facet("day", "day")}
          {facet("time", "time", {
            summaryValue:
              state.from || state.to
                ? `Starts ${state.from || "00:00"}–${state.to || "23:59"}`
                : undefined,
            before: (
              <Hint>Morning: before 12:00. Afternoon: 12:00–16:59. Evening: from 17:00.</Hint>
            ),
          })}
        </Group>
        <Group title="Where">
          {facet("venue", "venue", {
            summaryValue:
              state.independent && !state.excluded.venue?.length
                ? state.filters.venue?.length
                  ? `${state.filters.venue.length} selected · independent only`
                  : "Independent only"
                : undefined,
            before: (
              <ToggleRow
                label="Independent cinemas only"
                hint="Shows cinemas we’ve checked that are independent, charities or run by a public or educational body. Chains, and cinemas we haven’t checked yet, are left out."
                value={!!state.independent}
                onChange={(independent) => change({ independent })}
              />
            ),
          })}
          {facet("borough", "borough")}
          {facet("membership", "membership", {
            after: <Hint>Memberships show eligible venues. Check exclusions with the cinema.</Hint>,
          })}
        </Group>
        <Group title="What">
          {facet("genre", "genre")}
          {facet("format", "format")}
          {facet("language", "language")}
          <DecadeSection
            decades={decades}
            selected={state.decades ?? []}
            years={state.years ?? []}
            onToggle={(decade) => change(toggleDecade(state, decade))}
          />
          {facet("accessibility", "accessibility")}
        </Group>
        <Group title="Only show">
          <View style={styles.toggles}>
            <ToggleRow
              label="Hide sold-out screenings"
              value={state.available}
              onChange={(available) => change({ available })}
            />
            <ToggleRow
              label="Under 2 hours"
              value={!!state.short}
              onChange={(short) => change({ short })}
            />
          </View>
        </Group>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.m) }]}>
        <Pressable
          onPress={() => store.update(clearFilters(state.path))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Text>Reset all</Text>
        </Pressable>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          style={({ pressed }) => [styles.show, pressed && styles.pressed]}
        >
          <Text weight="medium" tone="onRed">
            Show {resultLabel(kind, count)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The quick filters, in the plan's order and in capitals: TODAY, TOMORROW, WEEKEND, WEEK and
 * EVENING toggle; the personal ones (MY WATCHLIST, MY CINEMAS, NEAR ME) have the brass outline,
 * and NEAR ME opens the location finder instead of toggling.
 */
function QuickFilters({
  items,
  onToggle,
  onNearby,
}: {
  items: ShortcutItem[];
  onToggle: (item: ShortcutItem) => void;
  onNearby: () => void;
}) {
  return (
    <View style={styles.quick} accessibilityLabel="Quick filters">
      {items.map((item) => {
        const personal = item.group === "personal";
        const opens = item.active === undefined;
        return (
          <Pressable
            key={item.id}
            onPress={() => (opens ? onNearby() : onToggle(item))}
            disabled={item.disabled}
            accessibilityRole={opens ? "button" : "togglebutton"}
            accessibilityState={
              opens
                ? { disabled: item.disabled }
                : { checked: !!item.active, disabled: item.disabled }
            }
            accessibilityLabel={item.label}
            accessibilityHint={item.title}
            style={({ pressed }) => [
              styles.quickItem,
              personal && styles.quickPersonal,
              item.active && styles.quickActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              size={2}
              weight="medium"
              tone={item.active ? "onRed" : personal ? "brass" : "fg"}
              style={styles.caps}
            >
              {item.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text
        size={1}
        weight="medium"
        tone="muted"
        accessibilityRole="header"
        style={styles.groupTitle}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/**
 * The Year row, by decade. The website's year picker also offers single years inside a decade;
 * the app keeps to decades for now and shows a single-year choice made elsewhere as a chip.
 */
function DecadeSection({
  decades,
  selected,
  years,
  onToggle,
}: {
  decades: { decade: number; count: number }[];
  selected: number[];
  years: number[];
  onToggle: (decade: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = selected.length + years.length;
  const summary = chosen
    ? chosen === 1 && selected.length === 1
      ? `${selected[0]}s`
      : `${chosen} selected`
    : "Any year";
  return (
    <View style={styles.decadeSection}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Year: ${summary}`}
        style={({ pressed }) => [styles.decadeHeader, pressed && styles.pressed]}
      >
        <Text style={styles.decadeLabel}>Year</Text>
        <Text size={2} tone={chosen ? "brass" : "muted"}>
          {summary}
        </Text>
        <Text tone="muted" accessibilityElementsHidden importantForAccessibility="no">
          {open ? "▴" : "▾"}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.decades}>
          {decades.map(({ decade, count }) => {
            const on = selected.includes(decade);
            return (
              <Pressable
                key={decade}
                onPress={() => onToggle(decade)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${decade}s, ${count}`}
                style={[styles.decade, on && styles.quickActive]}
              >
                <Text size={2} tone={on ? "onRed" : count ? "fg" : "muted"}>
                  {decade}s
                </Text>
                <Text size={1} tone={on ? "onRed" : "muted"}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.panel },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: space.xl,
    paddingBottom: space.m,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: space.s },
  close: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -space.s,
  },
  body: { flex: 1 },
  content: { paddingBottom: space.xl },
  quick: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.s,
    paddingHorizontal: space.l,
    paddingTop: space.l,
  },
  quickItem: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.m,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  quickPersonal: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.brass },
  quickActive: { backgroundColor: colors.red, borderColor: colors.red },
  caps: { letterSpacing: 0.6 },
  pressed: { opacity: 0.8 },
  search: { flexDirection: "row", paddingHorizontal: space.l, paddingTop: space.l },
  group: { marginTop: space.xl },
  groupTitle: { paddingHorizontal: space.l, marginBottom: space.xs, letterSpacing: 0.8 },
  toggles: { paddingHorizontal: space.l },
  decadeSection: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rowLine },
  decadeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: 52,
    paddingLeft: space.l + 20 + space.m,
    paddingRight: space.l,
  },
  decadeLabel: { flex: 1 },
  decades: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.s,
    paddingHorizontal: space.l,
    paddingBottom: space.m,
  },
  decade: {
    minWidth: 72,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  footer: {
    flexDirection: "row",
    gap: space.s,
    paddingTop: space.m,
    paddingHorizontal: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
  },
  reset: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  show: {
    flex: 2,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
    backgroundColor: colors.red,
  },
});
