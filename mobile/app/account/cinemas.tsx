import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useApp } from "../../src/providers";
import { Page, Text, Input, Chip, Button, Footer, Row, Notice, Section } from "../../src/ui";
export default function Cinemas() {
  const app = useApp(),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(app.cinemas),
    [dirty, setDirty] = useState(false);
  const savedKey = JSON.stringify(app.cinemas);
  useEffect(() => {
    if (!dirty) setSelected(JSON.parse(savedKey) as string[]);
  }, [savedKey, dirty]);
  const venues = app.data.data?.meta.venues ?? [];
  const toggle = (id: string) => {
    setDirty(true);
    setSelected((values) =>
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  };
  const matches = venues.filter((venue) =>
    `${venue.name} ${venue.group ?? ""} ${app.data.data?.meta.boroughs.find((borough) => borough.id === venue.borough)?.name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const groups = [...new Set(matches.map((venue) => venue.group ?? "Independent cinemas"))].sort();
  return (
    <Page>
      <Text tone="lede">
        Choose your cinemas.{" "}
        {app.signedIn
          ? "Your choices are saved to your account."
          : "Your choices are saved on this phone."}
      </Text>
      <Row>
        {selected.map((id) => (
          <Chip
            key={id}
            label={`${venues.find((venue) => venue.id === id)?.name ?? id} ×`}
            selected
            onPress={() => toggle(id)}
          />
        ))}
      </Row>
      <Input
        accessibilityLabel="Search cinemas"
        placeholder="Cinema, group or borough"
        value={search}
        onChangeText={setSearch}
      />
      {!matches.length ? <Text>No matching cinemas.</Text> : null}
      {groups.map((group) => (
        <Section key={group} title={group}>
          {[
            ...new Set(
              matches
                .filter((venue) => (venue.group ?? "Independent cinemas") === group)
                .map((venue) => venue.borough),
            ),
          ]
            .sort()
            .map((borough) => (
              <Section
                key={borough}
                title={
                  app.data.data?.meta.boroughs.find((value) => value.id === borough)?.name ??
                  borough
                }
              >
                {matches
                  .filter(
                    (venue) =>
                      (venue.group ?? "Independent cinemas") === group && venue.borough === borough,
                  )
                  .map((venue) => (
                    <Chip
                      key={venue.id}
                      label={venue.name}
                      selected={selected.includes(venue.id)}
                      onPress={() => toggle(venue.id)}
                    />
                  ))}
              </Section>
            ))}
        </Section>
      ))}
      {app.error ? (
        <Notice
          title="Cinemas could not be saved"
          actions={
            <Button
              label="Reload saved choices"
              onPress={() =>
                void app
                  .perform(async () => {
                    await app.reload();
                  })
                  .then((success) => {
                    if (success) router.back();
                  })
              }
            />
          }
        >
          {app.error}
        </Notice>
      ) : null}
      <Footer>
        <Button
          label="Save cinemas"
          selected
          disabled={app.busy || !app.ready || (app.signedIn && !app.user)}
          onPress={() =>
            void app.saveCinemas(selected).then((success) => {
              if (success) router.back();
            })
          }
        />
        <Button label="Cancel" onPress={() => router.back()} />
      </Footer>
    </Page>
  );
}
