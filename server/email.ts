export async function sendEmail(
  key: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string,
  headers?: Record<string, string>,
): Promise<void> {
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, text, ...(headers ? { headers } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error(`Email delivery failed (${result.status})`);
}
