/**
 * The only web platform APIs that core may use, declared by hand because core compiles
 * without the DOM and Node libraries. Both the browser and the app's JavaScript engine
 * provide them. Adding a member here is a decision that the app must provide it too; never
 * add `window`, `document`, `localStorage`, `navigator` or `fetch`.
 */
declare class URLSearchParams {
  constructor(init?: string);
  readonly size: number;
  get(name: string): string | null;
  getAll(name: string): string[];
  set(name: string, value: string): void;
  append(name: string, value: string): void;
  toString(): string;
}

declare class URL {
  constructor(url: string, base?: string);
  href: string;
  readonly protocol: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly username: string;
  readonly password: string;
  search: string;
  readonly searchParams: URLSearchParams;
}

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
