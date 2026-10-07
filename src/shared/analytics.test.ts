import { describe, it, expect } from "vitest";
import { acquisition, analyticsText, safeAnalyticsProperties } from "./analytics";

describe("analytics data boundary", () => {
  it("keeps only deliberate properties and never sends raw URLs or credentials", () => {
    const token = "a".repeat(64);
    const safe = safeAnalyticsProperties({
      path: "/auth/verify",
      $current_url: `https://london-cine.info/auth/verify?token=${token}`,
      $referrer: "https://example.com/private?email=person@example.com",
      email: "person@example.com",
      username: "private-name",
      cookie: token,
      query: `Amélie person@example.com ${token} https://example.com/private`,
      result_count: 0,
      filter_values: ["genre:drama"],
      $set: { email: "private" },
      $lib_custom_api_host: "https://private.example/secret",
    });
    expect(safe.$current_url).toBe("https://london-cine.info/auth/verify");
    expect(safe.query).toBe("Amélie [email] [token] [url]");
    expect(JSON.stringify(safe)).not.toContain(token);
    expect(safe).not.toHaveProperty("email");
    expect(safe).not.toHaveProperty("$lib_custom_api_host");
    expect(safe).not.toHaveProperty("$referrer");
    expect(safe).not.toHaveProperty("$set");
    expect(safe.filter_values).toEqual(["genre:drama"]);
    expect(analyticsText("x".repeat(500))).toHaveLength(200);
    expect(safeAnalyticsProperties({ path: "/private/secret", duration_ms: Infinity }).path).toBe(
      "/",
    );
  });
  it("separates organic search, referral, direct and explicit campaign sources", () => {
    const url = new URL("https://london-cine.info/new?q=alien&token=private");
    expect(acquisition(url, "https://www.google.co.uk/search?q=private").source).toBe(
      "organic_search",
    );
    expect(acquisition(url, "https://reddit.com/r/secret").referrer_host).toBe("reddit.com");
    expect(acquisition(url, "https://london-cine.info/watchlist").source).toBe("direct");
    expect(acquisition(url, "").source).toBe("direct");
    expect(
      acquisition(new URL(`${url}&utm_source=letterboxd&utm_campaign=launch`), ""),
    ).toMatchObject({
      source: "letterboxd",
      utm_campaign: "launch",
      landing_path: "/new",
    });
    expect(
      JSON.stringify(acquisition(url, "https://reddit.com/private?token=secret")),
    ).not.toContain("secret");
  });
});
