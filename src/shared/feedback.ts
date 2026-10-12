// Feedback is a PostHog API survey answered from our own form. The payload below is the whole
// contract: nothing else from the page, the SDK or the account is attached.

export const CONTACT_EMAIL = "diogo.seabra.diogo@gmail.com";
export const FEEDBACK_MAX_LENGTH = 4000;

export const FEEDBACK_CATEGORIES = {
  problem: "Problem",
  listing: "Listing correction",
  idea: "Idea",
  praise: "Praise",
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

export type FeedbackSurvey = {
  id: string;
  questions: { message: string; category: string; email: string };
};
/**
 * Created by `npm run feedback:survey`. Production stays null until the survey exists in the
 * project, and the form offers email instead. The test survey keeps local and CI submissions
 * out of the production response list.
 */
export const FEEDBACK_SURVEYS: { production: FeedbackSurvey | null; test: FeedbackSurvey } = {
  production: null,
  test: {
    id: "00000000-0000-4000-8000-00000000f00d",
    questions: {
      message: "00000000-0000-4000-8000-000000000001",
      category: "00000000-0000-4000-8000-000000000002",
      email: "00000000-0000-4000-8000-000000000003",
    },
  },
};
export const FEEDBACK_QUESTIONS = {
  message: "What happened, or what would make this better?",
  category: "What is it about?",
  email: "Email for a reply (optional)",
} as const;

/** Public, non-personal facts that help reproduce a report. Every field is allowlisted. */
export type FeedbackContext = {
  route: string;
  revision?: string;
  viewport?: "phone" | "tablet" | "desktop";
  dataVersion?: string;
  filmId?: string;
  errorCode?: string;
  changelogId?: string;
  resultCount?: number;
};
const SLUG = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;
export function safeFeedbackContext(context: FeedbackContext, routes: (path: string) => string) {
  const safe: FeedbackContext = { route: routes(context.route) };
  if (context.revision && /^[a-f0-9]{7,40}$/.test(context.revision))
    safe.revision = context.revision.slice(0, 12);
  if (context.viewport && ["phone", "tablet", "desktop"].includes(context.viewport))
    safe.viewport = context.viewport;
  if (context.dataVersion && !Number.isNaN(Date.parse(context.dataVersion)))
    safe.dataVersion = new Date(context.dataVersion).toISOString();
  for (const key of ["filmId", "errorCode", "changelogId"] as const)
    if (context[key] && SLUG.test(context[key])) safe[key] = context[key];
  if (Number.isSafeInteger(context.resultCount) && context.resultCount! >= 0)
    safe.resultCount = context.resultCount;
  return safe;
}
/** What the disclosure in the form lists, in the order it lists it. */
export function describeContext(context: FeedbackContext) {
  return [
    ["Page", context.route],
    ["Film", context.filmId],
    ["Error", context.errorCode],
    ["Change", context.changelogId],
    ["Results shown", context.resultCount?.toString()],
    ["Screening data", context.dataVersion],
    ["App version", context.revision],
    ["Screen", context.viewport],
  ].filter((row): row is [string, string] => !!row[1]);
}

export type FeedbackDraft = { message: string; category: FeedbackCategory | ""; email: string };
export function feedbackProblem(draft: FeedbackDraft) {
  const message = draft.message.trim();
  if (!message) return "Write a message first.";
  if (message.length > FEEDBACK_MAX_LENGTH)
    return `Keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString("en-GB")} characters.`;
  const email = draft.email.trim();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return "That email address doesn’t look right. Leave it empty if you don’t need a reply.";
  return null;
}

/** A single capture-API event in PostHog's survey response format. */
export function feedbackEvent({
  survey,
  draft,
  context,
  distinctId,
  submissionId,
  environment,
}: {
  survey: FeedbackSurvey;
  draft: FeedbackDraft;
  context: FeedbackContext;
  distinctId: string;
  submissionId: string;
  environment: string;
}) {
  const { questions } = survey;
  const email = draft.email.trim();
  const category = draft.category ? FEEDBACK_CATEGORIES[draft.category] : "";
  return {
    event: "survey sent",
    // Retries reuse the submission ID as the event UUID so PostHog can drop duplicates.
    uuid: submissionId,
    distinct_id: distinctId,
    properties: {
      $survey_id: survey.id,
      $survey_submission_id: submissionId,
      $survey_completed: true,
      $survey_questions: (["message", "category", "email"] as const).map((key) => ({
        id: questions[key],
        question: FEEDBACK_QUESTIONS[key],
      })),
      [`$survey_response_${questions.message}`]: draft.message.trim(),
      ...(category ? { [`$survey_response_${questions.category}`]: category } : {}),
      ...(email ? { [`$survey_response_${questions.email}`]: email } : {}),
      feedback_route: context.route,
      ...(context.revision ? { feedback_revision: context.revision } : {}),
      ...(context.viewport ? { feedback_viewport: context.viewport } : {}),
      ...(context.dataVersion ? { feedback_data_version: context.dataVersion } : {}),
      ...(context.filmId ? { feedback_film_id: context.filmId } : {}),
      ...(context.errorCode ? { feedback_error: context.errorCode } : {}),
      ...(context.changelogId ? { feedback_changelog_id: context.changelogId } : {}),
      ...(context.resultCount !== undefined ? { feedback_result_count: context.resultCount } : {}),
      environment,
      $lib: "london-cine-feedback",
      // Feedback never attaches to a person profile or location.
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
    },
  };
}

/** Plain text for the email and copy fallbacks. */
export function feedbackText(draft: FeedbackDraft, context: FeedbackContext) {
  return [
    draft.message.trim(),
    "",
    ...(draft.category ? [`Category: ${FEEDBACK_CATEGORIES[draft.category]}`] : []),
    ...describeContext(context).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}
