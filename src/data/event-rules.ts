export const NEW_RELEASE_DAYS = 56;
export const CLASSIC_YEARS = 5;
export const RETROSPECTIVE_MIN_FILMS = 3;

export const EVENT_NOTES =
  /(?:\bq\s*&\s*a\b|\bq\s*and\s*a\b|\bintro(?:duction)?\b|\bpanel\b|\blive\s+(?:score|music|organ|accompaniment)\b|\bsing[ -]?along\b|\bquiz\b|\bmarathon\b|\b(?:35|70)mm\b|\bin\s+concert\b|\bwith\s+(?:the\s+)?[^.]*orchestra\b)/i;

export function isEventScreening(category: string, notes?: string | null): boolean {
  return category !== "movie" || EVENT_NOTES.test(notes ?? "");
}
