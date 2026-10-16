import { signal } from "@preact/signals";
import { POSTHOG_HOST, POSTHOG_TOKEN, safePath } from "@lci/core/analytics";
import {
  FEEDBACK_SURVEYS,
  feedbackEvent,
  safeFeedbackContext,
  type FeedbackCategory,
  type FeedbackContext,
  type FeedbackDraft,
} from "@lci/core/feedback";
import { analyticsAllowed, browserDoNotTrack, feedbackIdentity } from "./analytics";

export type FeedbackRequest = {
  context: Omit<FeedbackContext, "route" | "revision" | "viewport">;
  category?: FeedbackCategory;
};
/** One form for the whole app; any control can ask for it without nesting dialogs. */
export const feedbackRequest = signal<FeedbackRequest | null>(null);
export function openFeedback(request: FeedbackRequest = { context: {} }) {
  feedbackRequest.value = request;
}

export function currentContext(request: FeedbackRequest, dataVersion?: string) {
  const width = window.innerWidth;
  return safeFeedbackContext(
    {
      dataVersion,
      ...request.context,
      route: location.pathname,
      revision: import.meta.env.VITE_APP_REVISION,
      viewport: width < 800 ? "phone" : width < 1100 ? "tablet" : "desktop",
    },
    safePath,
  );
}

export type FeedbackChannel = "ready" | "analytics-off" | "unavailable";
export function feedbackChannel(): FeedbackChannel {
  if (!analyticsAllowed() || browserDoNotTrack()) return "analytics-off";
  const identity = feedbackIdentity();
  const survey = FEEDBACK_SURVEYS[identity?.environment === "test" ? "test" : "production"];
  return identity && survey ? "ready" : "unavailable";
}

/**
 * Posts straight to PostHog's capture endpoint so the result reflects receipt, not a queued
 * SDK call. Returns false when it cannot be sent or PostHog does not accept it.
 */
export async function sendFeedback(draft: FeedbackDraft, context: FeedbackContext, id: string) {
  const identity = feedbackIdentity();
  const survey = FEEDBACK_SURVEYS[identity?.environment === "test" ? "test" : "production"];
  if (!identity || !survey) return false;
  const event = feedbackEvent({
    survey,
    draft,
    context,
    submissionId: id,
    ...identity,
  });
  try {
    const response = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        ...event,
        api_key: POSTHOG_TOKEN,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
