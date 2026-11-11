import { describe, expect, it } from "vitest";
import { releaseGridRowHeights } from "./grid-heights";

describe("releaseGridRowHeights", () => {
  it("clears the grid's minimum heights on every laid-out cell", () => {
    const layouts: ({ minHeight?: number } | undefined)[] = [
      { minHeight: 0 },
      { minHeight: 187 },
      { minHeight: 187 },
      {},
      undefined,
    ];
    releaseGridRowHeights({ getLayout: (index) => layouts[index] }, layouts.length);
    expect(layouts.map((layout) => layout?.minHeight)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("does nothing before the list mounts", () => {
    expect(() => releaseGridRowHeights(null, 3)).not.toThrow();
  });
});
