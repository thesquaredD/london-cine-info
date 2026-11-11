import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { formatDate } from "@readograph/core/catalogue";
import { EVENT_TYPES } from "@readograph/core/data/event-rules";
import { groupEvents } from "@readograph/core/event-view";
import { DEFAULT_DISPLAY, displayTitle } from "@readograph/core/display";
import type { DataMeta, EventOccurrence, Film } from "@readograph/core/data";
import { useCatalogue, useCatalogueStore } from "@/catalogue/provider";
import { CatalogueStatus } from "@/catalogue/status";
import { DetailLink, detailHref } from "@/films/detail-link";
import { ResultsBar } from "@/films/discovery-bar";
import { bookingLabel } from "@/films/present";
import { useNow } from "@/films/use-now";
import { useView, useViewStore } from "@/films/view-context";
import { eventResults, resultLabel } from "@/filters/results";
import { SearchAndFilters } from "@/filters/search-and-filters";
import { Banner, Notice } from "@/ui/notice";
import { openLink } from "@/ui/open-link";
import { Segmented } from "@/ui/segmented";
import { Text } from "@/ui/text";
import { colors, radius, space, touchTarget } from "@/ui/tokens";

type Item =
  | { type: "day"; key: string; date: string; count: number }
  | { type: "event"; key: string; event: EventOccurrence };

const VIEWS = [
  { value: "highlights", label: "Q&As, scores & talks" },
  { value: "", label: "All experiences" },
] as const;

/**
 * The Events tab: special cinema experiences in London date order, grouped by day as on the
 * website, with its two views (Q&As, scores & talks, or all experiences) and the event types.
 * Each event books in the in-app browser; a listed film opens its detail in this tab's stack.
 */
export default function EventsScreen() {
  const { catalogue, error, updateRequired, refreshing } = useCatalogue();
  const catalogueStore = useCatalogueStore();
  const store = useViewStore();
  const state = useView();
  const now = useNow();
  const events = useMemo(
    () => (catalogue ? eventResults(catalogue, state, now) : []),
    [catalogue, state, now],
  );
  const items = useMemo(
    () =>
      groupEvents(events).flatMap(([date, rows]): Item[] => [
        { type: "day", key: `day:${date}`, date, count: rows.length },
        ...rows.map((event): Item => ({ type: "event", key: event.id, event })),
      ]),
    [events],
  );
  const films = useMemo(
    () => new Map((catalogue?.films ?? []).map((film) => [film.id, film])),
    [catalogue],
  );

  if (!catalogue)
    return (
      <View style={styles.screen}>
        <CatalogueStatus />
      </View>
    );

  const eventType = state.eventType ?? "";
  const header = (
    <View>
      <SearchAndFilters scope="events" />
      <Segmented
        label="Events view"
        options={VIEWS}
        value={eventType === "highlights" || eventType === "" ? eventType : null}
        onChange={(value) => store.update({ eventType: value, page: 1 })}
      />
      <Segmented
        label="Event type"
        options={EVENT_TYPES.map((type) => ({ value: type.id as string, label: type.label }))}
        value={eventType}
        onChange={(value) => store.update({ eventType: value === eventType ? "" : value, page: 1 })}
      />
      {updateRequired ? (
        <Banner>New listings need the latest version of the app. Update it to see them.</Banner>
      ) : null}
      {error ? (
        <Banner>Showing saved listings. They will update when you are back online.</Banner>
      ) : null}
      <Text size={2} tone="muted" style={styles.note}>
        Special cinema experiences, in London date order. Formats alone are listed in Radar.
      </Text>
      <ResultsBar label={resultLabel("events", events.length)} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlashList
        data={items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Notice
            title="No events match"
            body="Try another event type, fewer filters or a shorter search."
          />
        }
        refreshing={refreshing}
        onRefresh={() => void catalogueStore.refresh()}
        renderItem={({ item }) =>
          item.type === "day" ? (
            <View style={styles.day} accessible accessibilityRole="header">
              <Text weight="medium">{formatDate(item.date).toUpperCase()}</Text>
              <Text size={2} tone="muted">
                {item.count} {item.count === 1 ? "event" : "events"}
              </Text>
            </View>
          ) : (
            <EventRow
              event={item.event}
              film={films.get(item.event.filmId)}
              meta={catalogue.meta}
            />
          )
        }
      />
    </View>
  );
}

const EventRow = memo(function EventRow({
  event,
  film,
  meta,
}: {
  event: EventOccurrence;
  film: Film | undefined;
  meta: DataMeta;
}) {
  const venue = meta.venues.find((item) => item.id === event.venue);
  const venueName = venue?.name ?? event.venue;
  const title = film ? displayTitle(film, DEFAULT_DISPLAY.titleMode) : event.title;
  const occasions = event.labels.filter(
    (label) => !title.toLowerCase().includes(label.toLowerCase()),
  );
  const label = bookingLabel(event);
  return (
    <View style={styles.event}>
      <Text size={6} weight="medium" style={styles.time}>
        {event.localTime}
      </Text>
      <View style={styles.eventText}>
        <Text size={4} weight="medium">
          {title}
          {occasions.length ? ` — ${occasions.join(" · ")}` : ""}
        </Text>
        <Text tone="muted">
          {venueName}
          {event.screen ? ` · Screen ${event.screen}` : ""}
        </Text>
        {event.notes ? (
          <Text size={2} tone="muted" numberOfLines={3}>
            {event.notes}
          </Text>
        ) : null}
        {event.soldOut ? (
          <Text size={2} weight="medium" tone="soldOut">
            Sold out
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => void openLink(event.bookingUrl)}
            accessibilityRole="link"
            accessibilityLabel={`${label === "Book" ? "Book" : "Screening details for"} ${event.title} at ${venueName} ${event.localTime}`}
            style={({ pressed }) => [
              styles.action,
              label === "Book" && styles.book,
              pressed && styles.pressed,
            ]}
          >
            <Text size={2} tone={label === "Book" ? "onRed" : "fg"}>
              {label} ↗
            </Text>
          </Pressable>
          {film ? (
            <DetailLink href={detailHref("events", film)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Film details: ${title}`}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text size={2}>Film details</Text>
              </Pressable>
            </DetailLink>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  note: { paddingHorizontal: space.l, paddingTop: space.m },
  day: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.l,
    paddingTop: 28,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.brassRuleSoft,
  },
  event: {
    flexDirection: "row",
    gap: space.m,
    paddingVertical: 14,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
  },
  time: { width: 72 },
  eventText: { flex: 1, minWidth: 0, gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginTop: space.s },
  action: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: space.m,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  book: { backgroundColor: colors.red, borderColor: colors.red },
  pressed: { opacity: 0.8 },
});
