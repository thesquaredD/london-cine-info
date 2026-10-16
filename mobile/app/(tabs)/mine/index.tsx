import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { formatDate } from "@lci/core/catalogue";
import { useApp } from "../../../src/providers";
import { groupCalendar } from "../../../src/preferences/model";
import { Discovery } from "../../../src/discovery";
import { Page, Row, Chip, Text, Button, Notice, Section, useTokens } from "../../../src/ui";
import { addToPhone, exportCalendar, openWebsite } from "../../../src/screenings";
export default function MyFilms() {
  const [tab, setTab] = useState("watchlist"),
    app = useApp(),
    c = useTokens();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16 }}>
        <Row>
          <Chip
            label="Watchlist"
            selected={tab === "watchlist"}
            onPress={() => setTab("watchlist")}
          />
          <Chip
            label="My calendar"
            selected={tab === "calendar"}
            onPress={() => setTab("calendar")}
          />
        </Row>
      </View>
      {tab === "watchlist" ? (
        <Discovery mode="watchlist" />
      ) : (
        <Page>
          {app.error ? (
            <Notice
              title="Calendar unavailable"
              actions={<Button label="Retry" onPress={() => void app.perform(app.reload)} />}
            >
              {app.error}
            </Notice>
          ) : null}
          {!app.signedIn ? (
            <Notice
              title="Sign in to save screenings"
              actions={<Button label="Sign in" onPress={() => router.push("/account/sign-in")} />}
            >
              Keep your saved screenings together in My calendar.
            </Notice>
          ) : (
            <>
              <Text>Saved screening details may change. Saving does not book a ticket.</Text>
              <Row>
                <Button
                  label="Refresh"
                  disabled={app.busy}
                  onPress={() => void app.perform(app.reload)}
                />
                <Button
                  label="Export all"
                  disabled={!app.calendar.length}
                  onPress={() => void app.perform(() => exportCalendar(app.calendar))}
                />
              </Row>
              {!app.calendar.length ? (
                <Text>No saved screenings yet. Open a film and choose Save to My calendar.</Text>
              ) : null}
              {groupCalendar(app.calendar).map(([day, rows]) => (
                <Section key={day} title={formatDate(day)}>
                  {rows.map((row) => (
                    <View key={row.id} style={{ gap: 12 }}>
                      <Text tone="heading">{row.title}</Text>
                      <Text>
                        {row.venueName} ·{" "}
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Europe/London",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(row.start)}
                      </Text>
                      <Row>
                        <Button
                          label="Booking details"
                          onPress={() => void app.perform(() => openWebsite(row.bookingUrl))}
                        />
                        <Button
                          label="Add to phone calendar"
                          onPress={() => void app.perform(() => addToPhone(row))}
                        />
                        <Button
                          label="Remove"
                          disabled={app.busy}
                          onPress={() => void app.saveScreening(row, row)}
                        />
                      </Row>
                    </View>
                  ))}
                </Section>
              ))}
            </>
          )}
        </Page>
      )}
    </View>
  );
}
