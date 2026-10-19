export const WELCOME_STORAGE = "london-cine.welcome-dismissed.v1";

/** True once this browser has left the welcome page, or when storage cannot be read. */
export function welcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_STORAGE) === "true";
  } catch {
    // Without storage the dismissal cannot be remembered, so do not show it on every visit.
    return true;
  }
}

export function rememberWelcomeDismissed() {
  try {
    localStorage.setItem(WELCOME_STORAGE, "true");
  } catch {
    // The welcome page simply stays dismissed for this visit.
  }
}

/**
 * The welcome page only replaces a first, unfiltered visit to the catalogue root.
 * Any query (filters, film, sort, page), hash or other path is an existing link and is kept.
 */
export function showsWelcomeOnArrival(url: URL, dismissed: boolean): boolean {
  return !dismissed && url.pathname === "/" && !url.search && !url.hash;
}
