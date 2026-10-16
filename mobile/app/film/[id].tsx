import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image, Share, View } from "react-native";
import {
  RATINGS,
  formatDate,
  runtime,
  viewUrl,
  readView,
  type ViewState,
} from "@lci/core/catalogue";
import { screeningMatcher } from "@lci/core/filters";
import { displayTitle } from "@lci/core/display";
import type { FilmShowtimes } from "@lci/core/data";
import { useApp, catalogue } from "../../src/providers";
import { useView } from "../../src/views";
import { Text, Page, Section, Button, Row, Notice } from "../../src/ui";
import { ScreeningActions, openWebsite } from "../../src/screenings";
import { SITE } from "../../src/catalogue/loader";
export default function FilmDetail() {
  const {
    id,
    source = "films",
    section,
  } = useLocalSearchParams<{ id: string; source: string; section?: ViewState["radarSection"] }>();
  const app = useApp(),
    data = app.data.data;
  const [view] = useView(source, source === "films" ? "/" : `/${source}`);
  const state = {
    ...view,
    ...(view.myCinemas ? { filters: { ...view.filters, venue: app.cinemas } } : {}),
    radarSection: section,
  };
  const [details, setDetails] = useState<FilmShowtimes | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const film = data?.films.find((film) => film.id === id);
  useEffect(() => {
    let active = true;
    setDetails(null);
    setError("");
    if (data)
      void catalogue
        .loadShowtimes(id)
        .then((value) => {
          if (active) setDetails(value);
        })
        .catch(() => {
          if (active) setError("Screenings could not be loaded. Check your connection and retry.");
        });
    return () => {
      active = false;
    };
  }, [id, data, attempt]);
  if (!film || !data)
    return (
      <Page>
        <Notice
          title="Film unavailable"
          actions={<Button label="Refresh listings" onPress={() => void catalogue.refresh()} />}
        >
          This film is not in the current catalogue.
        </Notice>
      </Page>
    );
  const matcher = screeningMatcher(data.meta, state);
  const days = details
    ? Object.entries(details.days)
        .map(([date, rows]) => [date, rows.filter((row) => matcher.showtime(date, row))] as const)
        .filter(([, rows]) => rows.length)
        .sort(([a], [b]) => a.localeCompare(b))
    : [];
  return (
    <Page>
      <Stack.Screen options={{ title: displayTitle(film, app.display.titleMode) }} />
      {film.po ? (
        <Image
          accessibilityLabel={`${film.ti} poster`}
          source={{ uri: film.po }}
          style={{ width: 180, height: 270, alignSelf: "center" }}
          resizeMode="contain"
        />
      ) : null}
      <Text accessibilityRole="header" tone="title">
        {displayTitle(film, app.display.titleMode)}
      </Text>
      {app.display.titleMode === "both" && film.o_ti && film.o_ti !== film.ti ? (
        <Text>{film.o_ti}</Text>
      ) : null}
      <Text>
        {[film.di.map((person) => person.name).join(", "), film.ye, runtime(film.ru)]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {details?.details.overview ? <Text>{details.details.overview}</Text> : null}
      {details?.details.actors.length ? (
        <Text muted>{details.details.actors.map((person) => person.name).join(", ")}</Text>
      ) : null}
      <Row>
        {(app.display.hideWatchlistRatings && (state.path === "/watchlist" || state.watchlist)
          ? []
          : app.display.ratingOrder
        ).map((key) =>
          film.ra[key] ? (
            <Button
              key={key}
              label={`${RATINGS.find((rating) => rating.key === key)!.name} ${film.ra[key]!.value ?? "—"}`}
              onPress={() => void app.perform(() => openWebsite(film.ra[key]!.url))}
            />
          ) : null,
        )}
      </Row>
      <Button
        label="Share film"
        onPress={() =>
          void app.perform(async () => {
            const url = SITE + viewUrl({ ...readView(new URL(SITE)), film: film.id });
            await Share.share({ message: url, url });
          })
        }
      />
      {app.error ? (
        <Notice
          title="Could not finish"
          actions={<Button label="Dismiss" onPress={app.dismissError} />}
        >
          {app.error}
        </Notice>
      ) : null}
      <Text tone="heading">Screenings</Text>
      <Text tone="small" muted>
        Saving does not book a ticket. End times are estimates; confirm programme changes with the
        cinema.
      </Text>
      {error ? (
        <Notice
          title="Screenings unavailable"
          actions={<Button label="Retry" onPress={() => setAttempt((value) => value + 1)} />}
        >
          {error}
        </Notice>
      ) : !details ? (
        <Text>Loading screenings…</Text>
      ) : !days.length ? (
        <Notice title="No matching screenings">
          Change your filters on the previous screen to see more dates.
        </Notice>
      ) : null}
      {days.map(([date, rows]) => (
        <Section key={date} title={formatDate(date)}>
          {[...new Set(rows.map((row) => row.venue))].map((venueId) => (
            <View key={venueId} style={{ gap: 12 }}>
              <Text tone="heading">
                {data.meta.venues.find((venue) => venue.id === venueId)?.name ?? venueId}
              </Text>
              {rows
                .filter((row) => row.venue === venueId)
                .sort((a, b) => a.time - b.time)
                .map((row) => (
                  <View key={`${row.time}-${row.screen}`} style={{ gap: 12 }}>
                    <Text>
                      {row.localTime}
                      {row.screen ? ` · Screen ${row.screen}` : ""}
                      {row.soldOut ? " · Sold out" : ""}
                    </Text>
                    <Text muted>
                      {[row.eventTitle, row.notes, ...row.formats, ...row.accessibility]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    <ScreeningActions film={film} showtime={row} />
                  </View>
                ))}
            </View>
          ))}
        </Section>
      ))}
    </Page>
  );
}
