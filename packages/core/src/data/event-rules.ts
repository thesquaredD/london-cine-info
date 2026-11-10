export const NEW_RELEASE_DAYS = 56;
export const CLASSIC_YEARS = 5;
export const RETROSPECTIVE_MIN_FILMS = 3;

export const EVENT_TYPES = [
  { id: "qa", label: "Q&As & intros" },
  { id: "score", label: "Live scores" },
  { id: "programme", label: "Double bills & programmes" },
  { id: "talk", label: "Talks" },
  { id: "other", label: "Other cinema experiences" },
] as const;
const cinema = /\b(?:cinema|film|filmmak(?:er|ing)|screening|movie|animation|documentary)\b/i;
const unrelated = /\b(?:board games?|networking|wine tasting|stand[ -]?up|comedy night)\b/i;
const labels: [RegExp, string, string][] = [
  [/\bq\s*(?:&|and)\s*a\b/i, "Q&A", "qa"],
  [/\bintro(?:duction|duced)?\b/i, "Introduction", "qa"],
  [
    /\blive\s+(?:score|music|organ|accompaniment)\b|\bwith\s+(?:the\s+)?[^.]*orchestra\b/i,
    "Live score",
    "score",
  ],
  [/\bdouble[ -]?bill\b/i, "Double bill", "programme"],
  [/\bmarathon\b/i, "Marathon", "programme"],
  [/\bshorts? programme\b/i, "Shorts programme", "programme"],
  [/\bsing[ -]?along\b/i, "Sing-along", "other"],
];
export function eventClassification(category: string, notes?: string | null, title = "") {
  const text = [title, notes].filter(Boolean).join(" · ");
  if (unrelated.test(text)) return [];
  const filmCategory = ["movie", "tv", "shorts", "multiple-movies"].includes(category);
  const found = labels
    .filter(
      ([pattern, label, type]) =>
        (pattern.test(notes ?? "") ||
          (pattern.test(title) &&
            (label !== "Introduction" ||
              /(?:\+|with|\()\s*(?:an?\s+)?intro(?:duction)?\b|^intro(?:duction)?\s*:/i.test(
                title,
              )) &&
            (label !== "Marathon" || /\bmarathon(?:\s*[[(].*)?$/i.test(title)))) &&
        (!["Introduction", "Marathon", "Sing-along"].includes(label) ||
          filmCategory ||
          cinema.test(text)) &&
        (type !== "score" ||
          category === "movie" ||
          cinema.test(text) ||
          /\blive (?:score|accompaniment)\b/i.test(text)),
    )
    .map(([, label, type]) => ({ label, type }));
  if (category === "multiple-movies")
    found.push({ label: "Double bill / programme", type: "programme" });
  if (category === "shorts") found.push({ label: "Shorts programme", type: "programme" });
  // Generic venue categories require explicit evidence tying the activity to cinema.
  if (cinema.test(text) || /\bimax\b.*\btour\b/i.test(text) || category === "movie") {
    if (category === "talk" || /\b(?:film talk|panel|discussion)\b/i.test(notes ?? ""))
      found.push({ label: "Film talk", type: "talk" });
    else if (["workshop", "quiz", "event"].includes(category))
      found.push({ label: "Cinema experience", type: "other" });
  }
  return found;
}
export function isEventScreening(category: string, notes?: string | null, title = ""): boolean {
  return eventClassification(category, notes, title).length > 0;
}
export function eventLabels(category: string, notes?: string | null, title = ""): string[] {
  return [...new Set(eventClassification(category, notes, title).map((item) => item.label))];
}
export function eventTypes(category: string, notes?: string | null, title = ""): string[] {
  return [...new Set(eventClassification(category, notes, title).map((item) => item.type))];
}
