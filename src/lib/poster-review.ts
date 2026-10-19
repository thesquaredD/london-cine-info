/**
 * REVIEW ONLY — remove once a poster hover treatment is chosen.
 *
 * `?hover=edge|strip|overlay` picks the treatment and `?posterTitle=1` adds the single-line
 * title beneath posters, so the alternatives can be compared in the real app. To finish the
 * review: delete this file and its call in main.tsx, set the chosen value as the default
 * `data-poster-hover` in index.html (or inline its rules), and drop the other variants'
 * rules from src/styles/posters.css.
 */
export const POSTER_HOVERS = ["edge", "strip", "overlay"] as const;
export type PosterHover = (typeof POSTER_HOVERS)[number];
export const DEFAULT_POSTER_HOVER: PosterHover = "strip";

export function posterReview(search: string): { hover: PosterHover; title: boolean } {
  const params = new URLSearchParams(search);
  const hover = params.get("hover");
  return {
    hover: POSTER_HOVERS.includes(hover as PosterHover)
      ? (hover as PosterHover)
      : DEFAULT_POSTER_HOVER,
    title: params.get("posterTitle") === "1",
  };
}

export function applyPosterReview(root: HTMLElement, search: string) {
  const { hover, title } = posterReview(search);
  root.dataset.posterHover = hover;
  if (title) root.dataset.posterTitle = "";
  else delete root.dataset.posterTitle;
}
