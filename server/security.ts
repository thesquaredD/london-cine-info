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
