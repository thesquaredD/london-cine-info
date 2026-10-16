import { describe, expect, it } from "vitest";
import { safePath } from "@lci/core/analytics";
import {
  FEEDBACK_SURVEYS,
  feedbackEvent,
  feedbackProblem,
  feedbackText,
  safeFeedbackContext,
} from "@lci/core/feedback";

const survey = FEEDBACK_SURVEYS.test;
const draft = {
  message: "  The 19:30 is listed as 19:00.  ",
  category: "listing",
  email: "",
} as const;

describe("feedback context", () => {
  it("keeps only allowlisted, well-formed public facts", () => {
    expect(
      safeFeedbackContext(
        {
          route: "/watchlist?token=secret",
          revision: "b2016e5e04f4a1b2c3d4e5f60718293a4b5c6d7e",
          viewport: "phone",
          dataVersion: "2026-10-03T09:00:00Z",
          filmId: "classic-a",
          errorCode: "<script>",
          changelogId: "whats-new",
          resultCount: -1,
          // Extra properties a caller might pass are dropped.
          ...({ email: "me@example.com" } as object),
        },
        safePath,
      ),
    ).toEqual({
      route: "/",
      revision: "b2016e5e04f4",
      viewport: "phone",
      dataVersion: "2026-10-03T09:00:00.000Z",
      filmId: "classic-a",
      changelogId: "whats-new",
    });
  });
});

describe("feedback validation", () => {
  it.each([
    [{ ...draft, message: "   " }, "Write a message first."],
    [{ ...draft, message: "x".repeat(4001) }, "Keep it under 4,000 characters."],
    [{ ...draft, email: "not-an-email" }, expect.stringContaining("doesn’t look right")],
    [{ ...draft, email: "me@example.com" }, null],
    [draft, null],
  ])("%#", (value, problem) => {
    expect(feedbackProblem(value)).toEqual(problem);
  });
});

describe("feedback event", () => {
  const context = { route: "/", filmId: "classic-a", viewport: "desktop" as const };
  const event = (overrides = {}) =>
    feedbackEvent({
      survey,
      draft: { ...draft, ...overrides },
      context,
      distinctId: "anon-1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      environment: "test",
    });

  it("is a PostHog survey response keyed by question ID, deduplicated by submission", () => {
    const { event: name, uuid, distinct_id, properties } = event();
    expect(name).toBe("survey sent");
    expect(uuid).toBe(properties.$survey_submission_id);
    expect(distinct_id).toBe("anon-1");
    expect(properties).toMatchObject({
      $survey_id: survey.id,
      $survey_completed: true,
      [`$survey_response_${survey.questions.message}`]: "The 19:30 is listed as 19:00.",
      [`$survey_response_${survey.questions.category}`]: "Listing correction",
      feedback_route: "/",
      feedback_film_id: "classic-a",
      feedback_viewport: "desktop",
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
    });
  });

  it("omits empty optional answers and never adds anything else", () => {
    const { properties } = event({ category: "" });
    expect(Object.keys(properties).sort()).toEqual(
      [
        "$survey_id",
        "$survey_submission_id",
        "$survey_completed",
        "$survey_questions",
        `$survey_response_${survey.questions.message}`,
        "feedback_route",
        "feedback_film_id",
        "feedback_viewport",
        "environment",
        "$lib",
        "$process_person_profile",
        "$geoip_disable",
        "$ip",
      ].sort(),
    );
  });

  it("includes a reply email only when one is given", () => {
    expect(event({ email: " me@example.com " }).properties).toMatchObject({
      [`$survey_response_${survey.questions.email}`]: "me@example.com",
    });
  });
});

it("the email fallback carries the message and the listed context only", () => {
  expect(feedbackText({ ...draft, email: "me@example.com" }, { route: "/", filmId: "a" })).toBe(
    "The 19:30 is listed as 19:00.\n\nCategory: Listing correction\nPage: /\nFilm: a",
  );
});
