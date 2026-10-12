import { useEffect, useState } from "preact/hooks";
import {
  currentContext,
  feedbackChannel,
  feedbackRequest,
  sendFeedback,
  type FeedbackChannel,
} from "../lib/feedback";
import {
  CONTACT_EMAIL,
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  describeContext,
  feedbackProblem,
  feedbackText,
  type FeedbackCategory,
  type FeedbackContext,
  type FeedbackDraft,
} from "../shared/feedback";
import { Dialog } from "./dialog";
import { PageLink } from "./page-link";

const EMPTY: FeedbackDraft = { message: "", category: "", email: "" };
type Status = "editing" | "sending" | "failed" | "sent";

/** Focus goes back to whichever feedback control is still visible, or the menu button. */
const restoreTo = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".feedback-entry, .menu-button")).find(
    (element) => element.getClientRects().length > 0,
  ) ?? null;

/**
 * Sends only on an explicit Send. The draft lives in memory for this visit, never in storage,
 * and survives closing and reopening the form.
 */
export function FeedbackDialog({
  dataVersion,
  onNavigate,
}: {
  dataVersion?: string;
  onNavigate: (path: string) => void;
}) {
  const request = feedbackRequest.value;
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY);
  const [status, setStatus] = useState<Status>("editing");
  const [problem, setProblem] = useState("");
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [channel, setChannel] = useState<FeedbackChannel>("unavailable");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (!request) return;
    setContext(currentContext(request, dataVersion));
    setChannel(feedbackChannel());
    setCopied("");
    setProblem("");
    if (status === "sent") setStatus("editing");
    if (request.category) setDraft((value) => ({ ...value, category: request.category! }));
    // Only a new request resets the form's surroundings; the draft itself carries over.
  }, [request]);
  const close = () => {
    feedbackRequest.value = null;
    if (status === "sent") {
      setDraft(EMPTY);
      setStatus("editing");
    }
  };
  const update = (changes: Partial<FeedbackDraft>) => {
    setDraft({ ...draft, ...changes });
    // Edited text is a new submission, not a retry of the failed one.
    if (status === "failed") setSubmissionId(crypto.randomUUID());
    setProblem("");
  };
  async function submit(event: Event) {
    event.preventDefault();
    if (status === "sending" || !context || channel !== "ready") return;
    const invalid = feedbackProblem(draft);
    if (invalid) return setProblem(invalid);
    if (!navigator.onLine) {
      setStatus("failed");
      return setProblem("You appear to be offline. Your text is still here; try again shortly.");
    }
    setStatus("sending");
    setProblem("");
    if (await sendFeedback(draft, context, submissionId)) {
      setStatus("sent");
      setSubmissionId(crypto.randomUUID());
    } else {
      setStatus("failed");
      setProblem("Your feedback wasn’t sent. Your text is still here: try again, or email it.");
    }
  }
  const text = context ? feedbackText(draft, context) : "";
  const fallback = (
    <div class="feedback-fallback">
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("London Ciné Info feedback")}&body=${encodeURIComponent(text)}`}
      >
        Email feedback
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied("Copied. Paste it into an email to " + CONTACT_EMAIL + ".");
          } catch {
            setCopied("Copying isn’t available here. Select the text above instead.");
          }
        }}
      >
        Copy feedback
      </button>
      {copied && (
        <span role="status" class="feedback-muted">
          {copied}
        </span>
      )}
    </div>
  );
  return (
    <Dialog
      open={!!request}
      title={status === "sent" ? "Thank you" : "Share feedback"}
      focusKey={status === "sent" ? "sent" : ""}
      className="modal-dialog feedback-dialog"
      onClose={close}
      restoreTo={restoreTo}
    >
      {status === "sent" ? (
        <div class="feedback-form">
          <p role="status">Received. Thank you for taking the time.</p>
          <p class="feedback-muted">
            Not every message gets a reply. If you left an email address, it is used only to answer
            this.
          </p>
          <button data-initial-focus class="feedback-primary" onClick={close}>
            Back to browsing
          </button>
        </div>
      ) : (
        <form class="feedback-form" onSubmit={submit} noValidate>
          <p>A problem, a listing correction, an idea or something you liked. No account needed.</p>
          <label>
            <span>
              What is it about? <span class="feedback-muted">(optional)</span>
            </span>
            <select
              value={draft.category}
              onChange={(event) =>
                update({ category: event.currentTarget.value as FeedbackCategory | "" })
              }
            >
              <option value="">Choose a topic</option>
              {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your feedback
            <textarea
              data-initial-focus
              required
              rows={5}
              maxLength={FEEDBACK_MAX_LENGTH}
              value={draft.message}
              onInput={(event) => update({ message: event.currentTarget.value })}
              placeholder="What happened, or what would make this better?"
            />
          </label>
          {channel === "ready" && (
            <label>
              <span>
                Email <span class="feedback-muted">(optional, only if you’d like a reply)</span>
              </span>
              <input
                type="email"
                autoComplete="email"
                value={draft.email}
                onInput={(event) => update({ email: event.currentTarget.value })}
              />
            </label>
          )}
          {context && (
            <details>
              <summary>What’s sent with it</summary>
              <dl class="feedback-context">
                {describeContext(context).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Never your watchlist, friends, searches, account email or a screenshot. Only what
                you type above is added.
              </p>
            </details>
          )}
          {channel === "ready" ? (
            <>
              <p class="feedback-muted">
                Stored privately in PostHog, our analytics provider, under this browser’s analytics
                ID (your account’s, if signed in). Only a reviewed summary, never your words or
                email, may become a public development issue.{" "}
                <PageLink
                  href="/privacy#feedback"
                  onNavigate={(path) => {
                    close();
                    onNavigate(path);
                  }}
                >
                  How feedback is handled
                </PageLink>
              </p>
              {problem && (
                <p role="alert" class="feedback-problem">
                  {problem}
                </p>
              )}
              {status === "failed" && fallback}
              <div class="feedback-actions">
                <button type="submit" class="feedback-primary" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : status === "failed" ? "Try again" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p class="feedback-problem" role="status">
                {channel === "analytics-off"
                  ? "Sending from the site uses analytics, which is off in this browser. Email it instead; your choice stays as it is."
                  : "Sending from the site isn’t available here. Email it instead."}
              </p>
              {fallback}
            </>
          )}
        </form>
      )}
    </Dialog>
  );
}
