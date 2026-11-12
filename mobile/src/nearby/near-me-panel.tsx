import { SheetScrollView } from "@/ui/sheet-components";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Linking, Pressable, StyleSheet, View, type HostInstance } from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ViewState } from "@readograph/core/catalogue";
import type { DataMeta } from "@readograph/core/data";
import type { Coordinates } from "@readograph/core/distance";
import {
  DEFAULT_NEARBY_RANGE,
  milesLabel,
  NEARBY_RANGES,
  setAllExcluded,
  toggleExcluded,
} from "@readograph/core/nearby";
import { useView } from "@/films/view-context";
import { Icon } from "@/ui/icon";
import { Text } from "@/ui/text";
import { colors, radius, space, touchTarget } from "@/ui/tokens";
import { nearMeAction, nearMeChanges, nearMePermission, nearMeResult } from "./near-me";

type Status =
  | { kind: "checking" }
  | { kind: "ask" }
  | { kind: "denied" }
  | { kind: "locating" }
  | { kind: "found"; point: Coordinates }
  | { kind: "failed" };

/** How long to wait for a position before saying so; the system prompt is not counted. */
const LOCATE_TIMEOUT = 15000;

/**
 * Near me, inside the Filters sheet (NEAR ME opens it; it is not a toggle). It asks for the
 * foreground location permission with an explanation first, reads one position at balanced
 * accuracy, and lists the cinemas within the chosen radius, nearest first, all ticked. Applying
 * it sets a temporary cinema filter, as on the website. When the permission is refused for
 * good, it says what that means and offers the phone's Settings.
 */
export function NearMePanel({
  headingRef,
  meta,
  events,
  onBack,
  onApply,
}: {
  headingRef: RefObject<HostInstance | null>;
  meta: DataMeta;
  events: boolean;
  onBack: () => void;
  onApply: (changes: Partial<ViewState>) => void;
}) {
  const state = useView();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [range, setRange] = useState<number>(DEFAULT_NEARBY_RANGE);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const locate = useCallback(async () => {
    setStatus({ kind: "locating" });
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), LOCATE_TIMEOUT),
        ),
      ]);
      if (live.current)
        setStatus({
          kind: "found",
          point: { lat: position.coords.latitude, lon: position.coords.longitude },
        });
    } catch {
      if (live.current) setStatus({ kind: "failed" });
    }
  }, []);

  const ask = useCallback(async () => {
    const answer = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!live.current) return;
    const permission = answer ? nearMePermission(answer) : "denied";
    if (permission === "granted") void locate();
    else setStatus({ kind: permission === "ask" ? "ask" : "denied" });
  }, [locate]);

  // Already allowed: go straight to the position. Otherwise explain before the system prompt.
  useEffect(() => {
    void Location.getForegroundPermissionsAsync()
      .then((answer) => {
        if (!live.current) return;
        const permission = nearMePermission(answer);
        if (permission === "granted") void locate();
        else setStatus({ kind: permission });
      })
      .catch(() => live.current && setStatus({ kind: "ask" }));
  }, [locate]);

  const result = useMemo(
    () => nearMeResult(meta, status.kind === "found" ? status.point : null, range, excluded),
    [meta, status, range, excluded],
  );
  const allSelected = result.venues.length > 0 && result.selected.length === result.venues.length;

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to filters"
          hitSlop={8}
          style={styles.back}
        >
          <Text size={5} accessibilityElementsHidden importantForAccessibility="no">
            ‹
          </Text>
        </Pressable>
        <View ref={headingRef} accessible accessibilityRole="header" style={styles.title}>
          <Text size={5} weight="medium">
            Near me
          </Text>
        </View>
      </View>
      <SheetScrollView style={styles.body} contentContainerStyle={styles.content}>
        {status.kind === "checking" || status.kind === "locating" ? (
          <Text tone="muted" accessibilityLiveRegion="polite">
            {status.kind === "locating" ? "Finding your location…" : " "}
          </Text>
        ) : null}
        {status.kind === "ask" ? (
          <View style={styles.message}>
            <Text>
              Readograph uses your location once, on this phone, to list the cinemas near you. It is
              not stored or sent anywhere.
            </Text>
            <Button label="Use my location" onPress={() => void ask()} primary />
          </View>
        ) : null}
        {status.kind === "denied" ? (
          <View style={styles.message}>
            <Text>
              Location access is off for Readograph, so it cannot find cinemas near you. You can
              turn it on in Settings, or choose cinemas in the Cinema filter instead.
            </Text>
            <Button label="Open Settings" onPress={() => void Linking.openSettings()} primary />
          </View>
        ) : null}
        {status.kind === "failed" ? (
          <View style={styles.message}>
            <Text>
              Your location isn’t available right now. Check that location is on, then try again.
            </Text>
            <Button label="Try again" onPress={() => void locate()} primary />
          </View>
        ) : null}
        {status.kind === "found" ? (
          <>
            <Text size={2} tone="muted" style={styles.label}>
              DISTANCE
            </Text>
            <View
              style={styles.ranges}
              accessibilityRole="radiogroup"
              accessibilityLabel="Distance"
            >
              {NEARBY_RANGES.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRange(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: value === range }}
                  style={[styles.range, value === range && styles.rangeOn]}
                >
                  <Text size={2} tone={value === range ? "onRed" : "fg"}>
                    {milesLabel(value)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text
              tone={result.venues.length ? "muted" : "soldOut"}
              accessibilityLiveRegion="polite"
              style={styles.status}
            >
              {result.venues.length
                ? `${result.venues.length} ${result.venues.length === 1 ? "cinema" : "cinemas"} within ${milesLabel(range)} of your location.`
                : `No cinemas within ${milesLabel(range)} of your location. Try a wider range.`}
            </Text>
            {result.venues.length ? (
              <Pressable
                onPress={() => setExcluded(setAllExcluded(excluded, result.venues, allSelected))}
                accessibilityRole="button"
                style={styles.all}
              >
                <Text size={2} tone="brass">
                  {allSelected ? "Clear all" : "Select all"}
                </Text>
              </Pressable>
            ) : null}
            {result.venues.map((venue) => {
              const on = result.selected.includes(venue.id);
              return (
                <Pressable
                  key={venue.id}
                  onPress={() => setExcluded(toggleExcluded(excluded, venue.id))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${venue.name}, ${venue.distance.toFixed(1)} miles`}
                  style={styles.venue}
                >
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on ? <Icon name="check" size={14} color={colors.onRed} /> : null}
                  </View>
                  <Text style={styles.venueName}>{venue.name}</Text>
                  <Text size={2} tone="muted">
                    {venue.distance.toFixed(1)} mi
                  </Text>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </SheetScrollView>
      {status.kind === "found" ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.m) }]}>
          <Button
            label={nearMeAction(result.selected.length, events)}
            disabled={!result.selected.length}
            onPress={() => onApply(nearMeChanges(state, result.selected))}
            primary
          />
        </View>
      ) : null}
    </View>
  );
}

function Button({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text weight="medium" tone={primary ? "onRed" : "fg"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.panel },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.xl,
    paddingBottom: space.m,
    paddingHorizontal: space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  back: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
  body: { flex: 1 },
  content: { padding: space.l, paddingBottom: space.xxxl },
  message: { gap: space.l },
  label: { letterSpacing: 0.8, marginBottom: space.s },
  ranges: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  range: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    justifyContent: "center",
    paddingHorizontal: space.m,
    borderRadius: radius,
    backgroundColor: colors.shade,
  },
  rangeOn: { backgroundColor: colors.red },
  status: { marginTop: space.l },
  all: { alignSelf: "flex-end", minHeight: touchTarget, justifyContent: "center" },
  venue: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: touchTarget + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
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
  venueName: { flex: 1 },
  footer: {
    paddingTop: space.m,
    paddingHorizontal: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.l,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.red, borderColor: colors.red },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
