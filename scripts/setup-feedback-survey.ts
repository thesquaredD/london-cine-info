import { randomUUID } from "node:crypto";
import { FEEDBACK_CATEGORIES, FEEDBACK_QUESTIONS, type FeedbackSurvey } from "@lci/core/feedback";

// Creates (or finds) the API-type survey the in-app form answers. Prints the config to paste
// into FEEDBACK_SURVEYS in packages/core/src/feedback.ts. Never commit the personal API key.
const host = "https://eu.posthog.com";
const root = `${host}/api/projects/296412/`;
const NAME = process.argv.includes("--test")
  ? "London Cine — feedback (test)"
  : "London Cine — feedback";
const definition = {
  name: NAME,
  description: "Answered by the in-app Feedback form. Managed by scripts/setup-feedback-survey.ts.",
  type: "api",
  questions: [
    { id: randomUUID(), type: "open", question: FEEDBACK_QUESTIONS.message },
    {
      id: randomUUID(),
      type: "single_choice",
      question: FEEDBACK_QUESTIONS.category,
      choices: Object.values(FEEDBACK_CATEGORIES),
      optional: true,
    },
    { id: randomUUID(), type: "open", question: FEEDBACK_QUESTIONS.email, optional: true },
  ],
  start_date: new Date().toISOString(),
};
if (process.argv.includes("--print")) {
  console.log(JSON.stringify(definition, null, 2));
} else {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key)
    throw new Error(
      "Set POSTHOG_PERSONAL_API_KEY locally (survey read/write scope), or use --print. Never commit the key.",
    );
  type Survey = { id: string; name: string; archived?: boolean; questions: { id: string }[] };
  async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    if (!url.startsWith(root))
      throw new Error("Refusing to send credentials outside the project API");
    const response = await fetch(url, {
      method,
      redirect: "error",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`PostHog ${method} failed (${response.status}): ${await response.text()}`);
    return (await response.json()) as T;
  }
  const existing = (await api<{ results: Survey[] }>(`${root}surveys/?limit=200`)).results.find(
    (survey) => survey.name === NAME && !survey.archived,
  );
  const survey = existing ?? (await api<Survey>(`${root}surveys/`, "POST", definition));
  const [message, category, email] = survey.questions.map((question) => question.id);
  if (!message || !category || !email) throw new Error("Unexpected survey question layout");
  const config: FeedbackSurvey = { id: survey.id, questions: { message, category, email } };
  console.log(`${existing ? "Found" : "Created"} ${host}/project/296412/surveys/${survey.id}`);
  console.log(JSON.stringify(config, null, 2));
}
