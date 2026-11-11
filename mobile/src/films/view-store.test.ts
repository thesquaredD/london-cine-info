import { describe, expect, it } from "vitest";
import { createViewStore, initialView } from "./view-store";

describe("view store update rules", () => {
  it("turns My cinemas off when the cinema choice changes", () => {
    const store = createViewStore({
      ...initialView("/"),
      myCinemas: true,
      filters: { venue: ["a"] },
    });
    store.update({ filters: { venue: ["a", "b"] } });
    expect(store.getState().myCinemas).toBe(false);
  });

  it("keeps My cinemas when the change sets it or leaves the cinemas alone", () => {
    const store = createViewStore({
      ...initialView("/"),
      myCinemas: true,
      filters: { venue: ["a"] },
    });
    store.update({ filters: { venue: ["a"], genre: ["horror"] } });
    expect(store.getState().myCinemas).toBe(true);
    store.update({ myCinemas: true, filters: { venue: ["b"] } });
    expect(store.getState().myCinemas).toBe(true);
  });

  it("turns Tonight off and clears its time range when the day or time changes", () => {
    const tonight = initialView("/?tonight=1");
    const store = createViewStore(tonight);
    store.update({ filters: { ...tonight.filters, day: ["tomorrow"] } });
    expect(store.getState()).toMatchObject({ tonight: false, from: "", to: "" });
  });
});
