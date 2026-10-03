import { z } from "zod";

export const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), "Expected an HTTP(S) URL");
const movieId = z.string().regex(/^[A-Za-z0-9_-]+$/);
const date = z.union([z.iso.date(), z.literal("")]);
// The feed uses numeric TMDB genre IDs in some unmatched records and strings
// elsewhere. Normalize both representations before resolving references.
const identifier = z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String);
const stringList = z.array(identifier);
const flag = z.boolean().optional();
const performance = z.object({
  time: z
    .number()
    .int()
    .min(0)
    .max(Date.UTC(2100, 0, 1)),
  showingId: z.string().min(1),
  bookingUrl: z.string(),
  screen: z.string().optional(),
  notes: z.string().optional(),
  status: z.object({ soldOut: flag }).optional(),
  format: z
    .object({
      source: z.string().min(1).optional(),
      presentation: z.string().min(1).optional(),
      dimension: z.string().min(1).optional(),
    })
    .optional(),
  accessibility: z
    .object({
      audioDescription: flag,
      subtitled: flag,
      hardOfHearing: flag,
      relaxed: flag,
      babyFriendly: flag,
    })
    .optional(),
});
const movie = z.object({
  id: movieId,
  title: z.string().min(1),
  originalTitle: z.string().optional(),
  originalLanguage: z.string().optional(),
  year: z
    .union([z.string().regex(/^(?:\d{4})?$/), z.number().int().min(1800).max(2100)])
    .optional(),
  releaseDate: date.optional(),
  duration: z.number().nonnegative().optional(),
  classification: z.string().optional(),
  overview: z.string().optional(),
  posterPath: z
    .string()
    .regex(/^\/[A-Za-z0-9._/-]+$/)
    .nullable()
    .optional(),
  youtubeTrailer: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  genres: stringList,
  directors: stringList.default([]),
  actors: stringList.default([]),
  isUnmatched: z.boolean().default(false),
  showings: z.record(
    z.string(),
    z.object({ venueId: z.string().min(1), category: z.string().min(1), url: httpUrl }),
  ),
  performances: z.array(performance),
});
export const combinedSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  movies: z.record(movieId, movie),
  venues: z.record(
    z.string(),
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      address: z.string(),
      url: httpUrl,
      geo: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
      groupName: z.string().optional(),
    }),
  ),
  people: z.record(z.string(), z.object({ id: z.string(), name: z.string().min(1) })),
  genres: z.record(z.string(), z.object({ id: z.string(), name: z.string().min(1) })),
});
const nullableScore = (max: number) => z.number().min(0).max(max).nullable().optional();
export const matchedSchema = z.object({
  letterboxd: z.record(movieId, z.object({ url: httpUrl, rating: nullableScore(5) })),
  imdb: z.record(movieId, z.object({ url: httpUrl, rating: nullableScore(10) })),
  metacritic: z.record(
    movieId,
    z.object({ url: httpUrl, critics: z.object({ rating: nullableScore(100) }).optional() }),
  ),
  rottentomatoes: z.record(
    movieId,
    z.object({
      url: httpUrl,
      critics: z.object({ all: z.object({ score: nullableScore(100) }).optional() }).optional(),
    }),
  ),
});
export type Combined = z.infer<typeof combinedSchema>;
export type Matched = z.infer<typeof matchedSchema>;
export type RawMovie = Combined["movies"][string];
export type RawPerformance = RawMovie["performances"][number];

export function validate<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 10)
    .map((issue) => `${source}.${issue.path.join(".")}: ${issue.message}`);
  throw new Error(
    `Upstream schema validation failed (${result.error.issues.length} issues):\n${issues.join("\n")}`,
  );
}
