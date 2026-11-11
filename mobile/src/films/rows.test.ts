import { describe, expect, it } from "vitest";
import type { Film } from "@readograph/core/data";
import { filmCount, gridColumns, listItems } from "./rows";
import { initialView } from "./view-store";

const film = (id: string, rd: string | null, retro: string[] = []) =>
  ({
    id,
    ti: id,
    rd,
    retro,
    di: [{ id: "varda", name: "Agnès Varda" }],
  }) as unknown as Film;

describe("listItems", () => {
  it("is one item per film outside the grouped collections", () => {
    expect(listItems([film("a", null), film("b", null)], initialView("/"))).toEqual([
      expect.objectContaining({ type: "film", key: "a" }),
      expect.objectContaining({ type: "film", key: "b" }),
    ]);
  });

  it("groups the Release calendar by release date, unknown dates last", () => {
    const items = listItems(
      [film("x", null), film("b", "2026-12-04"), film("a", "2026-11-20"), film("c", "2026-12-04")],
      initialView("/calendar"),
    );
    expect(items.map((item) => (item.type === "group" ? item.name : item.key))).toEqual([
      "Released on 20 November 2026",
      "a",
      "Released on 4 December 2026",
      "b",
      "c",
      "Released later · date unknown",
      "x",
    ]);
    expect(items[2]).toMatchObject({ type: "group", count: 2 });
  });

  it("groups Retrospectives by director", () => {
    const items = listItems([film("cleo", null, ["varda"])], initialView("/retrospectives"));
    expect(items.map((item) => item.key)).toEqual(["group:varda", "varda:cleo"]);
  });

  it("counts films", () => {
    expect([filmCount(1), filmCount(1500)]).toEqual(["1 film", "1,500 films"]);
  });

  it("restarts the grid's columns after each heading", () => {
    const items = listItems(
      [
        film("a", "2026-11-20"),
        film("b", "2026-11-20"),
        film("c", "2026-11-20"),
        film("d", "2026-11-20"),
        film("e", null),
      ],
      initialView("/calendar"),
    );
    expect([...gridColumns(items)]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 0],
      ["e", 0],
    ]);
  });
});
