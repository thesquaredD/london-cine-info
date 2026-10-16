import { Platform, Linking } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { createEventInCalendarAsync } from "expo-calendar/legacy";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { calendarFile } from "@lci/core/ical";
import { screeningKey, type CalendarInput, type CalendarScreening } from "@lci/core/calendar";
import type { Film, Showtime } from "@lci/core/data";
import { useApp } from "./providers";
import { capture } from "./analytics";
import { Button, Row } from "./ui";
export async function openWebsite(url: string) {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("This link could not be opened.");
  await WebBrowser.openBrowserAsync(url);
}
export async function exportCalendar(rows: CalendarScreening[]) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this phone.");
  const file = new File(Paths.cache, "london-screenings.ics");
  file.write(calendarFile(rows));
  await Sharing.shareAsync(file.uri, { mimeType: "text/calendar", UTI: "public.calendar-event" });
}
export async function addToPhone(event: CalendarInput) {
  // The OS editor lets the user select a calendar and confirm. No calendar is read by us.
  await createEventInCalendarAsync({
    title: event.title,
    startDate: new Date(event.start),
    ...(event.end ? { endDate: new Date(event.end) } : {}),
    location: [event.venueName, event.address].filter(Boolean).join(", "),
    notes: `${event.bookingUrl}\n${event.notes ?? ""}\nSaved details may change. ${event.end ? "End time is estimated." : "Runtime unknown; choose an end time."}`,
    timeZone: "Europe/London",
    ...(Platform.OS === "ios" ? { url: event.bookingUrl } : {}),
  });
}
export function ScreeningActions({ film, showtime }: { film?: Film; showtime: Showtime }) {
  const app = useApp();
  const venue = app.data.data?.meta.venues.find((venue) => venue.id === showtime.venue);
  const input: CalendarInput | null =
    venue && film
      ? {
          filmId: film.id,
          title: film.ti,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address,
          start: showtime.time,
          end: film.ru ? showtime.time + film.ru * 60_000 : null,
          bookingUrl: showtime.bookingUrl,
          screen: showtime.screen,
          notes: showtime.notes,
          formats: showtime.formats,
        }
      : null;
  const saved = input
    ? app.calendar.find((event) => screeningKey(event) === screeningKey(input))
    : undefined;
  return (
    <Row>
      <Button
        label={
          showtime.bookingFallback
            ? "Screening details"
            : showtime.soldOut
              ? "Sold out · Details"
              : "Book"
        }
        onPress={() =>
          void app.perform(async () => {
            capture(showtime.bookingFallback ? "screening_details_clicked" : "booking_clicked", {
              film_id: film?.id ?? "",
            });
            await openWebsite(showtime.bookingUrl);
          })
        }
      />
      {input ? (
        <>
          <Button
            label={saved ? "Remove from My calendar" : "Save to My calendar"}
            disabled={app.busy}
            onPress={() =>
              app.signedIn ? void app.saveScreening(input, saved) : router.push("/account/sign-in")
            }
          />
          <Button
            label="Add to phone calendar"
            onPress={() => void app.perform(() => addToPhone(input))}
          />
        </>
      ) : null}
    </Row>
  );
}
export function CalendarSettingsButton() {
  return <Button label="Open Settings" onPress={() => void Linking.openSettings()} />;
}
