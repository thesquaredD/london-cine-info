import { expect, it } from "vitest";
import { hash, token, localDevelopment, sessionCookie, sameOrigin } from "../../server/security";
it("stores hashes, produces random tokens and restricts development links to loopback", async () => {
  const first = token();
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(token()).not.toBe(first);
  expect(await hash("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  expect(localDevelopment(new Request("https://public.example"), "1")).toBe(false);
  expect(localDevelopment(new Request("http://localhost"), "1")).toBe(true);
  expect(localDevelopment(new Request("http://localhost"))).toBe(false);
  expect(sessionCookie(first)).toContain("Secure; HttpOnly; SameSite=Lax");
  expect(
    sameOrigin(
      new Request("https://site.example/api", { headers: { Origin: "https://evil.example" } }),
    ),
  ).toBe(false);
});
