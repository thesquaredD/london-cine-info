import { z } from "zod";

// Plain sentences only: no markup, links, mentions or line breaks reach the public page.
const plain = (limit: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(limit)
    .refine(
      (value) => !/[<>\n\r`*_[\]]|https?:\/\/|www\.|@\w/.test(value),
      "Use short plain text without markup, URLs or mentions",
    );

export const CHANGELOG_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const changelogFragmentSchema = z
  .object({
    id: z.string().max(80).regex(CHANGELOG_ID),
    type: z.enum(["added", "improved", "fixed"]),
    title: plain(80),
    body: plain(320),
    visibility: z.enum(["public", "internal"]),
    reason: plain(240).optional(),
    feature: z.string().max(60).regex(CHANGELOG_ID).optional(),
    href: z
      .string()
      .max(120)
      .regex(/^\/[a-z0-9-]*(?:#[a-z0-9-]+)?$/, "Use a same-origin app path such as /settings")
      .optional(),
    linkLabel: plain(40).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.visibility === "internal" && !entry.reason)
      ctx.addIssue({ code: "custom", message: "Internal entries need a reviewable reason" });
    if (entry.visibility === "public" && entry.reason)
      ctx.addIssue({ code: "custom", message: "Public entries do not take an internal reason" });
    if (!entry.href !== !entry.linkLabel)
      ctx.addIssue({ code: "custom", message: "href and linkLabel belong together" });
  });
export type ChangelogFragment = z.infer<typeof changelogFragmentSchema>;

/** A published note. `changeDate` is when the fragment reached main, not when it went live. */
export type ChangelogEntry = Pick<
  ChangelogFragment,
  "id" | "type" | "title" | "body" | "href" | "linkLabel"
> & { changeDate: string | null };
export type ChangelogBundle = { revision: string; entries: ChangelogEntry[] };
/** Served beside the app so a deployment can be checked against the commit it was built from. */
export type VersionManifest = { revision: string; changelogHash: string; entryIds: string[] };
