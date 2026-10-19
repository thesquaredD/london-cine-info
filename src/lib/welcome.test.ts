import { afterEach, expect, test, vi } from "vitest";
import {
  WELCOME_STORAGE,
  rememberWelcomeDismissed,
  showsWelcomeOnArrival,
  welcomeDismissed,
} from "./welcome";

afterEach(() => vi.unstubAllGlobals());

test("welcome shows only on an unfiltered catalogue root", () => {
  const at = (path: string) => showsWelcomeOnArrival(new URL(path, "https://example.test"), false);
  expect(at("/")).toBe(true);
  expect(at("/?venue=barbican.org.uk")).toBe(false);
  expect(at("/?film=abc")).toBe(false);
  expect(at("/?cinemas=mine")).toBe(false);
  expect(at("/#main-content")).toBe(false);
  expect(at("/events")).toBe(false);
  expect(at("/welcome")).toBe(false);
  expect(showsWelcomeOnArrival(new URL("https://example.test/"), true)).toBe(false);
});

test("dismissal is remembered and storage failures fail closed", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  expect(welcomeDismissed()).toBe(false);
  rememberWelcomeDismissed();
  expect(store.get(WELCOME_STORAGE)).toBe("true");
  expect(welcomeDismissed()).toBe(true);

  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
  expect(welcomeDismissed()).toBe(true);
  expect(() => rememberWelcomeDismissed()).not.toThrow();
});
