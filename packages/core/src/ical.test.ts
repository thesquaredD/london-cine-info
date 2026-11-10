import { expect, it } from "vitest";
import { calendarFile } from "./ical";
import { validCalendarInput, type CalendarScreening } from "./calendar";
const event: CalendarScreening = {
  id: "a".repeat(64),
  filmId: "film",
  title: "Cinema,;\\\r\nEND:VEVENT\r\nBEGIN:VEVENT",
  venueId: "venue",
  venueName: "Cinéma 🎬",
  address: "London",
  start: Date.parse("2026-10-25T00:30:00Z"),
  end: Date.parse("2026-10-25T02:30:00Z"),
  bookingUrl: "https://cinema.example/booking",
  screen: "1",
  notes: "long 🎬".repeat(50),
  formats: ["35mm"],
};
it("exports exact UTC starts across repeated DST hours, estimated ends and stable UIDs", () => {
  const file = calendarFile(
    [event, { ...event, id: "b".repeat(64), start: Date.parse("2026-10-25T01:30:00Z"), end: null }],
    Date.parse("2026-10-04T12:00:00Z"),
  );
  expect(file).toContain("DTSTART:20261025T003000Z\r\n");
  expect(file).toContain("DTSTART:20261025T013000Z\r\n");
  expect(file).toContain("DTEND:20261025T023000Z\r\n");
  expect(file.match(/^DTEND:/gm)).toHaveLength(1);
  expect(file.replace(/\r\n /g, "")).toContain(`UID:${event.id}@london-cine.info`);
  expect(file).toContain("DTSTAMP:20261004T120000Z");
});
it("escapes text injection, folds UTF-8 lines and terminates with CRLF", () => {
  const file = calendarFile([event]);
  expect(file.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  const unfolded = file.replace(/\r\n /g, "");
  expect(unfolded).toContain("SUMMARY:Cinema\\,\\;\\\\\\nEND:VEVENT\\nBEGIN:VEVENT");
  expect(unfolded).toContain("Cinéma 🎬");
  expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
  for (const line of file.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
});
it("validates saved screening details and rejects unsafe URLs, newlines and invalid end times", () => {
  expect(validCalendarInput(event)).toBe(true);
  expect(
    validCalendarInput({ ...event, bookingUrl: "https://cinema.example\r\nSUMMARY:malicious" }),
  ).toBe(false);
  expect(validCalendarInput({ ...event, bookingUrl: "javascript:alert(1)" })).toBe(false);
  expect(validCalendarInput({ ...event, end: event.start })).toBe(false);
  expect(validCalendarInput({ ...event, start: NaN })).toBe(false);
});
