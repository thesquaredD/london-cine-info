export async function sendEmail(
  key: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string,
  headers?: Record<string, string>,
  html?: string,
): Promise<void> {
  return sendEmailPayload(
    key,
    {
      from,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
      ...(headers ? { headers } : {}),
    },
    idempotencyKey,
  );
}
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};
export async function sendEmailPayload(
  key: string,
  payload: EmailPayload,
  idempotencyKey: string,
): Promise<void> {
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) {
    const data = (await result.json().catch(() => null)) as { name?: string } | null;
    const codes = [
      "invalid_idempotent_request",
      "concurrent_idempotent_requests",
      "rate_limit_exceeded",
    ];
    const code = codes.includes(data?.name ?? "") ? data!.name! : "unknown";
    throw new EmailDeliveryError(result.status, code);
  }
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Email delivery failed (${status})`);
    this.name = "EmailDeliveryError";
  }
}
