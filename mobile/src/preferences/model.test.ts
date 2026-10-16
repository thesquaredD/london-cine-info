import { expect, it } from "vitest";
import { cinemaMerge, validVenues, groupCalendar } from "./model";
import type { CalendarScreening } from "@lci/core/calendar";
it("reuses a persisted merge identity without duplicating guest choices or adding remote removals back", () => {
  const guest = {
    browserId: "11111111-1111-4111-8111-111111111111",
    venues: ["bfi", "bfi", "pcc"],
  };
  expect(cinemaMerge(guest)).toEqual({ browserId: guest.browserId, venues: ["bfi", "pcc"] });
  expect(cinemaMerge(guest)).toEqual(cinemaMerge(guest));
  expect(validVenues(["../invalid"])).toBe(false);
  expect(validVenues(["pcc", "bfi"])).toBe(true);
});
it("groups exact UTC starts by London day across BST midnight and repeated DST hours", () => {
  const row = (id: string, start: string) =>
    ({ id, start: Date.parse(start) }) as CalendarScreening;
  const grouped = groupCalendar([
    row("c", "2026-10-25T01:30:00Z"),
    row("a", "2026-10-24T23:30:00Z"),
    row("b", "2026-10-25T00:30:00Z"),
  ]);
  expect(grouped).toHaveLength(1);
  expect(grouped[0]![0]).toBe("2026-10-25");
  expect(grouped[0]![1].map((row) => row.id)).toEqual(["a", "b", "c"]);
});
