import { AccountError } from "@lci/core/account-error";
import { SITE } from "../catalogue/loader";
export type Credentials = { session: string; expiresAt: number; userId: string };
export type CredentialStorage = {
  read(): Promise<Credentials | null>;
  write(value: Credentials | null): Promise<void>;
};
export function createSession(
  storage: CredentialStorage,
  transport: typeof fetch = fetch,
  headers: () => Record<string, string> = () => ({ "X-Analytics-Enabled": "0" }),
) {
  let credentials: Credentials | null = null;
  let epoch = 0;
  let writes: Promise<void> = Promise.resolve();
  const persist = (value: Credentials | null, generation: number) => {
    const work = writes
      .catch(() => {})
      .then(async () => {
        if (generation === epoch) await storage.write(value);
      });
    writes = work;
    return work;
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const clear = async () => {
    epoch++;
    credentials = null;
    emit();
    await persist(null, epoch);
  };
  return {
    getSnapshot: () => credentials,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async restore() {
      const generation = ++epoch;
      const saved = await storage.read();
      if (generation !== epoch) return;
      if (
        saved &&
        /^[a-f0-9]{64}$/.test(saved.session) &&
        typeof saved.userId === "string" &&
        saved.expiresAt * 1000 > Date.now()
      )
        credentials = saved;
      else await persist(null, generation);
      emit();
    },
    async accept(value: Credentials) {
      if (
        !/^[a-f0-9]{64}$/.test(value.session) ||
        !value.userId ||
        !Number.isFinite(value.expiresAt)
      )
        throw new Error("Sign-in could not be confirmed. Request a new code.");
      const generation = ++epoch;
      await persist(value, generation);
      if (generation !== epoch) return;
      credentials = value;
      emit();
    },
    clear,
    async api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
      const generation = epoch,
        identity = credentials;
      let response: Response;
      try {
        response = await transport(`${SITE}${path}`, {
          method,
          credentials: "omit",
          signal: AbortSignal.timeout(20_000),
          headers: {
            ...headers(),
            Origin: SITE,
            ...(identity ? { Authorization: `Bearer ${identity.session}` } : {}),
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw new AccountError(
          "We could not reach the account service. Check your connection and try again.",
        );
      }
      if (response.status === 401) {
        if (generation === epoch) await clear();
        throw new AccountError("Your session has expired. Please sign in again.", 401);
      }
      let result: Record<string, unknown>;
      try {
        result = await response.json();
        if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
      } catch {
        throw new AccountError(
          "The account service returned an unexpected response. Please try again later.",
          response.status,
        );
      }
      if (!response.ok) {
        const retry = Number(response.headers.get("Retry-After"));
        throw new AccountError(
          typeof result.error === "string"
            ? result.error
            : "The request failed. Please try again later.",
          response.status,
          retry ? Date.now() / 1000 + retry : null,
        );
      }
      if (identity && generation !== epoch)
        throw new AccountError("Your account changed. Please try again.");
      // /me extends the same server session. Keep the local expiry aligned without storing tokens elsewhere.
      if (path === "/api/me" && method === "GET" && identity && result.user) {
        const next = { ...identity, expiresAt: Math.floor(Date.now() / 1000) + 90 * 86400 };
        await persist(next, generation);
        if (generation !== epoch) throw new AccountError("Your account changed. Please try again.");
        credentials = next;
        emit();
      }
      return result as T;
    },
  };
}
