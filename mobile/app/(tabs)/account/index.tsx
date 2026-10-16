import tmdbLogo from "../../../assets/tmdb-logo.png";
import { useEffect, useState } from "react";
import { Alert, Switch, Image } from "react-native";
import { router } from "expo-router";
import { RATINGS } from "@lci/core/catalogue";
import { moveRating, type TitleMode } from "@lci/core/display";
import { session, useApp } from "../../../src/providers";
import { Page, Section, Row, Text, Button, Input, Notice } from "../../../src/ui";
import { openWebsite } from "../../../src/screenings";
import { SITE } from "../../../src/catalogue/loader";
export default function Account() {
  const app = useApp(),
    [username, setUsername] = useState("");
  useEffect(() => setUsername(app.user?.username ?? ""), [app.user?.username]);
  return (
    <Page>
      <Text tone="lede">Your films, cinemas and preferences.</Text>
      {app.error ? (
        <Notice
          title="Could not finish"
          actions={
            <>
              <Button label="Retry" onPress={() => void app.perform(app.reload)} />
              <Button label="Dismiss" onPress={app.dismissError} />
            </>
          }
        >
          {app.error}
        </Notice>
      ) : null}
      {!app.signedIn ? (
        <Button label="Sign in" selected onPress={() => router.push("/account/sign-in")} />
      ) : (
        <>
          <Text>{app.user?.email ?? "Loading account…"}</Text>
          <Section title="Letterboxd watchlist">
            <Input
              accessibilityLabel="Letterboxd username"
              placeholder="Letterboxd username"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <Button
              label="Save username"
              disabled={app.busy}
              onPress={() =>
                void app.perform(async () => {
                  await session.api("/api/me", "PUT", { username });
                  await app.reload();
                })
              }
            />
            <Text>Import: {app.user?.sync?.state ?? "idle"}</Text>
            {app.user?.sync?.error ? <Text>{app.user.sync.error}</Text> : null}
            <Text muted>
              {app.user?.fetchedAt
                ? `${app.user.count} films · Last imported ${new Date(app.user.fetchedAt * 1000).toLocaleString("en-GB")}${app.user.stale ? " · May be out of date" : ""}`
                : "No completed import yet."}
            </Text>
            <Button
              label="Refresh watchlist"
              disabled={
                app.busy ||
                !app.user?.username ||
                username !== app.user.username ||
                app.user.pending ||
                (app.user.sync?.retryAt != null && app.user.sync.retryAt * 1000 > Date.now())
              }
              onPress={() =>
                void app.perform(async () => {
                  await session.api("/api/watchlist/refresh", "POST", {});
                  await app.reload();
                })
              }
            />
          </Section>
        </>
      )}
      <Section title="My cinemas">
        <Text>{app.cinemas.length} cinemas selected.</Text>
        <Button label="Choose cinemas" onPress={() => router.push("/account/cinemas")} />
      </Section>
      <Section title="Display">
        <Row>
          {(["both", "title", "original"] as TitleMode[]).map((mode) => (
            <Button
              key={mode}
              label={
                mode === "both"
                  ? "Title & original"
                  : mode === "title"
                    ? "Title only"
                    : "Original title"
              }
              selected={app.display.titleMode === mode}
              disabled={app.busy}
              onPress={() =>
                void app.setPreferences({ display: { ...app.display, titleMode: mode } })
              }
            />
          ))}
        </Row>
        <Row>
          <Text>Hide ratings in my watchlist</Text>
          <Switch
            accessibilityLabel="Hide watchlist ratings"
            value={!!app.display.hideWatchlistRatings}
            onValueChange={(value) =>
              void app.setPreferences({ display: { ...app.display, hideWatchlistRatings: value } })
            }
          />
        </Row>
        <Text>Rating order</Text>
        {app.display.ratingOrder.map((key, index) => (
          <Row key={key}>
            <Text>{RATINGS.find((rating) => rating.key === key)!.name}</Text>
            <Button
              label={`Move ${RATINGS.find((rating) => rating.key === key)!.short} up`}
              disabled={!index || app.busy}
              onPress={() =>
                void app.setPreferences({
                  display: {
                    ...app.display,
                    ratingOrder: moveRating(app.display.ratingOrder, key, index - 1),
                  },
                })
              }
            />
            <Button
              label={`Move ${RATINGS.find((rating) => rating.key === key)!.short} down`}
              disabled={index === 3 || app.busy}
              onPress={() =>
                void app.setPreferences({
                  display: {
                    ...app.display,
                    ratingOrder: moveRating(app.display.ratingOrder, key, index + 1),
                  },
                })
              }
            />
          </Row>
        ))}
      </Section>
      <Section title="Privacy">
        <Row>
          <Text>Share usage analytics</Text>
          <Switch
            accessibilityLabel="Usage analytics"
            value={app.analytics}
            disabled={app.busy}
            onValueChange={(analytics) => void app.setPreferences({ analytics })}
          />
        </Row>
        <Text muted>
          Off by default. No email, search text, location, session token or booking URL is sent in
          analytics.
        </Text>
        <Button
          label="Privacy policy"
          onPress={() => void app.perform(() => openWebsite(`${SITE}/privacy`))}
        />
        <Button
          label="What’s new"
          onPress={() => void app.perform(() => openWebsite(`${SITE}/changelog`))}
        />
        <Button
          label="Friends and email settings"
          onPress={() => void app.perform(() => openWebsite(`${SITE}/account`))}
        />
      </Section>
      <Section title="Sources">
        <Text>
          Screenings and film information from Clusterflick. Ratings link to their original
          providers.
        </Text>
        <Image
          source={tmdbLogo}
          accessibilityLabel="The Movie Database"
          style={{ width: 180, height: 24 }}
          resizeMode="contain"
        />
        <Text tone="small" muted>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </Text>
        <Button
          label="About and source licences"
          onPress={() => void app.perform(() => openWebsite(`${SITE}/about`))}
        />
      </Section>
      {app.signedIn ? (
        <Section title="Account">
          <Button label="Sign out" disabled={app.busy} onPress={() => void app.signOut()} />
          <Button
            label="Delete account"
            disabled={app.busy}
            destructive
            onPress={() =>
              Alert.alert(
                "Delete your account?",
                "This permanently deletes your account, saved screenings and cinema preferences.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete account",
                    style: "destructive",
                    onPress: () => void app.deleteAccount(),
                  },
                ],
              )
            }
          />
        </Section>
      ) : null}
    </Page>
  );
}
