import { expect, it } from "vitest";
import { posterReview } from "./poster-review";
it("reads the review-only hover treatment and title toggle", () => {
  expect(posterReview("")).toEqual({ hover: "strip", title: false });
  expect(posterReview("?hover=edge&posterTitle=1")).toEqual({ hover: "edge", title: true });
  expect(posterReview("?hover=overlay")).toEqual({ hover: "overlay", title: false });
  expect(posterReview("?hover=curtain")).toEqual({ hover: "strip", title: false });
  for (const value of ["0", "true", "yes", ""])
    expect(posterReview(`?posterTitle=${value}`).title).toBe(false);
});
