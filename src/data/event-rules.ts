export const NEW_RELEASE_DAYS = 56;
export const CLASSIC_YEARS = 5;
export const RETROSPECTIVE_MIN_FILMS = 3;

export const EVENT_NOTES =
  /(?:\bq\s*&\s*a\b|\bq\s*and\s*a\b|\bintro(?:duction)?\b|\bpanel\b|\blive\s+(?:score|music|organ|accompaniment)\b|\bsing[ -]?along\b|\bquiz\b|\bmarathon\b|\b(?:35|70)mm\b|\bin\s+concert\b|\bwith\s+(?:the\s+)?[^.]*orchestra\b)/i;

export function isEventScreening(category: string, notes?: string | null): boolean {
  return category !== "movie" || EVENT_NOTES.test(notes ?? "");
}

const categories: Record<string, string> = {
  "multiple-movies": "Double bill / programme",
  shorts: "Shorts",
  talk: "Talk",
  tv: "TV",
  event: "Event",
  music: "Music",
  comedy: "Comedy",
  workshop: "Workshop",
  quiz: "Quiz",
};
const noteLabels: [RegExp, string][] = [
  [/\bq\s*(?:&|and)\s*a\b/i, "Q&A"],
  [/\bintro(?:duction)?\b/i, "Intro"],
  [/\bpanel\b/i, "Panel"],
  [
    /\blive\s+(?:score|music|organ|accompaniment)\b|\bwith\s+(?:the\s+)?[^.]*orchestra\b/i,
    "Live score",
  ],
  [/\bsing[ -]?along\b/i, "Sing-along"],
  [/\bquiz\b/i, "Quiz"],
  [/\bmarathon\b/i, "Marathon"],
  [/\b35mm\b/i, "35mm"],
  [/\b70mm\b/i, "70mm"],
  [/\bin\s+concert\b/i, "In concert"],
];
export function eventLabels(category: string, notes?: string | null): string[] {
  return [
    ...new Set([
      ...(category !== "movie" ? [categories[category] ?? "Special event"] : []),
      ...noteLabels.filter(([pattern]) => pattern.test(notes ?? "")).map(([, label]) => label),
    ]),
  ];
}
