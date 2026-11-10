import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Font sizes come from the --text-* ladder in base.css, so the scale cannot erode into
// one-off pixel values again.
const dir = join(__dirname);
const sheets = readdirSync(dir).filter((name) => name.endsWith(".css"));
const PX_SIZE = /\bfont(?:-size)?\s*:[^;{}]*?\b\d+(?:\.\d+)?px/g;

describe("type scale", () => {
  it.each(sheets)("%s sets no font size in pixels", (name) => {
    const css = readFileSync(join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const hits = (css.match(PX_SIZE) ?? []).filter(
      // A shorthand line-height or a letter-spacing in px is fine; only the size matters.
      (hit) => !/font(?:-size)?\s*:\s*[^;]*\/\s*\d+px$/.test(hit),
    );
    expect(hits).toEqual([]);
  });

  it("keeps every ladder step at or above 13px", () => {
    const base = readFileSync(join(dir, "base.css"), "utf8");
    const steps = [...base.matchAll(/--text-\d+:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
    expect(steps.length).toBeGreaterThan(0);
    for (const px of steps) expect(px).toBeGreaterThanOrEqual(13);
  });
});
