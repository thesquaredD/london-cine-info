import type { CalendarScreening } from "./calendar";
const stamp = (time: number) =>
  new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const escape = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
// RFC 5545 §3.1: fold at 75 octets without breaking a UTF-8 character.
function fold(line: string): string {
  let result = "",
    width = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (width + size > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += size;
  }
  return result;
}
export function calendarFile(events: CalendarScreening[], now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//London Cine Info//Saved Screenings//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:London cinema screenings",
  ];
  for (const event of events) {
    const description = [
      event.formats.join(" · "),
      event.screen ? `Screen ${event.screen}` : "",
      event.notes ?? "",
      event.end
        ? "End time is estimated from the film runtime; introductions and adverts may change it."
        : "Runtime unknown; no end time provided.",
      "Saved screening details; confirm programme changes with the cinema.",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@london-cine.info`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.start)}`,
    );
    if (event.end !== null) lines.push(`DTEND:${stamp(event.end)}`);
    lines.push(
      `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape([event.venueName, event.address].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${escape(description)}`,
      `URL:${event.bookingUrl}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
