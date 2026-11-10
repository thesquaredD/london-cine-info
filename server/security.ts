export const SESSION_SECONDS = 90 * 86400;
export function token(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function hash(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function localDevelopment(request: Request, enabled?: string): boolean {
  const host = new URL(request.url).hostname;
  return enabled === "1" && ["localhost", "127.0.0.1", "[::1]"].includes(host);
}
export function sessionCookie(value: string, seconds = SESSION_SECONDS): string {
  return `__Host-session=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}
export const CODE_ATTEMPTS = 5;
/** A six-digit sign-in code, uniform over 000000–999999. */
export function signInCode(): string {
  const limit = 4_294_000_000; // largest multiple of 1e6 below 2^32, so no modulo bias
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0]! >= limit);
  return String(value[0]! % 1_000_000).padStart(6, "0");
}
/** The stored form of a code, bound to its own token row. */
export function codeHash(tokenHash: string, code: string): Promise<string> {
  return hash(`${tokenHash}:${code}`);
}
/** Compares two strings without returning early on the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++)
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}
