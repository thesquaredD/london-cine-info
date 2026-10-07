import type { Film } from "../shared/data";

export type YearSelection = { decades?: number[]; years?: number[] };
export const decadeOf = (year: number) => Math.floor(year / 10) * 10;
export const decadeYears = (decade: number) => Array.from({ length: 10 }, (_, i) => decade + i);
const validYear = (year: number) => Number.isInteger(year) && year >= 1800 && year <= 2999;
export function normalizeYears(selection: YearSelection): Required<YearSelection> {
  const decades = [
    ...new Set((selection.decades ?? []).filter((d) => validYear(d) && d % 10 === 0)),
  ];
  const years = new Set((selection.years ?? []).filter(validYear));
  for (const decade of new Set([...years].map(decadeOf))) {
    if (decadeYears(decade).every((year) => years.has(year))) decades.push(decade);
  }
  const whole = [...new Set(decades)].sort((a, b) => b - a);
  return {
    decades: whole,
    years: [...years].filter((year) => !whole.includes(decadeOf(year))).sort((a, b) => b - a),
  };
}
export function hasYears(selection: YearSelection): boolean {
  return Boolean(selection.decades?.length || selection.years?.length);
}
export function yearMatches(year: number | null, selection: YearSelection): boolean {
  return (
    !hasYears(selection) ||
    (year !== null &&
      ((selection.decades ?? []).includes(decadeOf(year)) ||
        (selection.years ?? []).includes(year)))
  );
}
export function toggleDecade(selection: YearSelection, decade: number): Required<YearSelection> {
  const current = normalizeYears(selection);
  return normalizeYears({
    decades: current.decades.includes(decade)
      ? current.decades.filter((d) => d !== decade)
      : [...current.decades, decade],
    years: current.years.filter((year) => decadeOf(year) !== decade),
  });
}
export function toggleYear(selection: YearSelection, year: number): Required<YearSelection> {
  const current = normalizeYears(selection),
    decade = decadeOf(year);
  if (current.decades.includes(decade))
    return normalizeYears({
      decades: current.decades.filter((d) => d !== decade),
      years: [...current.years, ...decadeYears(decade).filter((y) => y !== year)],
    });
  return normalizeYears({
    decades: current.decades,
    years: current.years.includes(year)
      ? current.years.filter((y) => y !== year)
      : [...current.years, year],
  });
}
export function yearSummary(selection: YearSelection): string {
  const { decades, years } = normalizeYears(selection);
  if (!decades.length)
    return years.length === 0
      ? "Any year"
      : years.length <= 2
        ? years.join(", ")
        : `${years.length} years`;
  const label =
    decades.length <= 2 ? decades.map((d) => `${d}s`).join(", ") : `${decades.length} decades`;
  return (
    label + (years.length ? ` + ${years.length} ${years.length === 1 ? "year" : "years"}` : "")
  );
}
export function catalogueDecades(films: Film[]): number[] {
  return [
    ...new Set(
      films.flatMap((film) => (film.ye !== null && validYear(film.ye) ? [decadeOf(film.ye)] : [])),
    ),
  ].sort((a, b) => b - a);
}
export function countYears(films: Film[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const film of films)
    if (film.ye !== null) counts.set(film.ye, (counts.get(film.ye) ?? 0) + 1);
  return counts;
}
