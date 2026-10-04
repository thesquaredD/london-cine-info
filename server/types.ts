export type Env = {
  DB: D1Database;
  RATE_LIMITS: KVNamespace;
  SITE_URL: string;
  RESEND_FROM: string;
  RESEND_API_KEY?: string;
  GITHUB_DISPATCH_TOKEN?: string;
  DEV_MAGIC_LINK?: string;
};
export type User = {
  id: string;
  email: string;
  letterboxd_username: string | null;
  digest_weekday: number | null;
  unsubscribe_token: string;
  fetched_at: number | null;
  count_parsed: number | null;
  error: string | null;
  requested_at: number | null;
  completed_at: number | null;
};
