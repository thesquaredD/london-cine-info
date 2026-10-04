export type CalendarScreening = {
  id: string;
  filmId: string;
  title: string;
  venueId: string;
  venueName: string;
  address: string;
  start: number;
  end: number | null;
  bookingUrl: string;
  screen: string | null;
  notes: string | null;
  formats: string[];
};
export type CalendarInput = Omit<CalendarScreening, "id">;
export function screeningKey(
  event: Pick<CalendarInput, "filmId" | "venueId" | "start" | "screen">,
): string {
  return JSON.stringify([event.filmId, event.venueId, event.start, event.screen]);
}
export function validCalendarInput(value: unknown): value is CalendarInput {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const text = (key: string, length: number, nullable = false) =>
    (nullable && row[key] === null) ||
    (typeof row[key] === "string" &&
      row[key].length <= length &&
      [...row[key]].every(
        (char) => char.charCodeAt(0) >= 32 || [9, 10, 13].includes(char.charCodeAt(0)),
      ));
  if (
    !text("filmId", 160) ||
    !text("venueId", 160) ||
    !row.filmId ||
    !row.venueId ||
    !text("title", 500) ||
    !row.title ||
    !text("venueName", 300) ||
    !row.venueName ||
    !text("address", 1000) ||
    !text("screen", 160, true) ||
    !text("notes", 2000, true)
  )
    return false;
  if (
    typeof row.start !== "number" ||
    !Number.isSafeInteger(row.start) ||
    row.start < 0 ||
    row.start > 4102444800000
  )
    return false;
  if (
    row.end !== null &&
    (typeof row.end !== "number" ||
      !Number.isSafeInteger(row.end) ||
      row.end <= row.start ||
      row.end - row.start > 86400000)
  )
    return false;
  if (
    !Array.isArray(row.formats) ||
    row.formats.length > 31 ||
    !row.formats.every(
      (format) => typeof format === "string" && format.length <= 80 && !/[\r\n]/.test(format),
    )
  )
    return false;
  if (
    typeof row.bookingUrl !== "string" ||
    row.bookingUrl.length > 2000 ||
    /[\s\\]/.test(row.bookingUrl)
  )
    return false;
  try {
    const url = new URL(row.bookingUrl);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
