import { useEffect, useState } from "preact/hooks";
import {
  currentContext,
  openFeedback,
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
} from "@lci/core/feedback";
import { Dialog } from "./dialog";
import { PageLink } from "./page-link";

export function FeedbackEntry() {
  return (
    <button
      class="feedback-entry feedback-header"
      aria-label="Share feedback"
      title="Share feedback"
      onClick={() => openFeedback()}
    >
      <svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-5 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
      <span>Feedback</span>
    </button>
  );
}

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
  const [wantReply, setWantReply] = useState(false);
  const [phone, setPhone] = useState(() => matchMedia("(max-width: 799px)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width: 799px)");
    const change = () => setPhone(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
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
      setWantReply(false);
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
  const contextLine = context && (
    <p class="feedback-context-line">
      <span class="prose-eyebrow">Sent with it</span>{" "}
      <span class="feedback-context">
        {describeContext(context).map(([label, value], index) => (
          <span key={label}>
            {index > 0 && " · "}
            <span class="feedback-muted">{label}</span> {value}
          </span>
        ))}
      </span>{" "}
      Nothing else: not your watchlist, friends, searches or account email.
    </p>
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
          <footer class="prose-footer">
            <button data-initial-focus class="feedback-primary" onClick={close}>
              Back to browsing
            </button>
          </footer>
        </div>
      ) : (
        <form class="feedback-form" onSubmit={submit} noValidate>
          <div class="feedback-fields">
            <label>
              What happened, or what would make this better?
              <textarea
                aria-label="Your feedback"
                data-initial-focus
                required
                rows={5}
                maxLength={FEEDBACK_MAX_LENGTH}
                value={draft.message}
                onInput={(event) => update({ message: event.currentTarget.value })}
                placeholder="A problem, a wrong listing, an idea, or something you liked. No account needed."
              />
            </label>
            <fieldset class="feedback-topics">
              <legend>Topic (optional)</legend>
              <div>
                {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={draft.category === value}
                    onClick={() =>
                      update({
                        category: draft.category === value ? "" : (value as FeedbackCategory),
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {channel === "ready" && (
              <div class="prose-control feedback-reply">
                <label>
                  <input
                    type="checkbox"
                    checked={wantReply || draft.email !== ""}
                    onChange={(event) => {
                      setWantReply(event.currentTarget.checked);
                      if (!event.currentTarget.checked) update({ email: "" });
                    }}
                  />
                  I'd like a reply
                </label>
                {(wantReply || draft.email !== "") && (
                  <label class="feedback-email">
                    Email, used only to answer this
                    <input
                      type="email"
                      autoComplete="email"
                      value={draft.email}
                      onInput={(event) => update({ email: event.currentTarget.value })}
                    />
                  </label>
                )}
              </div>
            )}
            {context &&
              (phone ? (
                <details>
                  <summary>What’s sent with it</summary>
                  {contextLine}
                </details>
              ) : (
                contextLine
              ))}
            {problem && (
              <p role="alert" class="feedback-problem">
                {problem}
              </p>
            )}
            {channel === "ready" && status === "failed" && fallback}
          </div>
          <footer class="prose-footer">
            {channel === "ready" ? (
              <>
                <p>
                  Stored privately in PostHog under this browser’s analytics ID (your account’s, if
                  signed in).{" "}
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
                <button type="submit" class="feedback-primary" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : status === "failed" ? "Try again" : "Send"}
                </button>
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
          </footer>
        </form>
      )}
    </Dialog>
  );
}
