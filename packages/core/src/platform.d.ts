// Minimal standard globals supported by browsers and Hermes. No browser or Node APIs.
interface URLSearchParams {
  get(key: string): string | null;
  getAll(key: string): string[];
  set(key: string, value: string): void;
  append(key: string, value: string): void;
  readonly size: number;
  toString(): string;
}
declare const URLSearchParams: { new (init?: string): URLSearchParams };
interface URL {
  readonly protocol: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly origin: string;
  readonly username: string;
  readonly password: string;
  readonly href: string;
  readonly searchParams: URLSearchParams;
}
declare const URL: { new (input: string, base?: string): URL };
