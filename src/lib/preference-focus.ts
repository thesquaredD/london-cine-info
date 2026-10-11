import { useEffect, useRef } from "preact/hooks";

/** Focus the page on arrival, or a section named by an email/privacy link. */
export function usePreferenceFocus(ready = true) {
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready) return;
    const focusSection = () => {
      const section = Array.from(
        article.current?.querySelectorAll<HTMLElement>("section[id]") ?? [],
      ).find((node) => `#${node.id}` === location.hash);
      if (!section) return false;
      section.scrollIntoView({ block: "start" });
      section.focus({ preventScroll: true });
      return true;
    };
    let observer: MutationObserver | null = null;
    const followHash = () => {
      observer?.disconnect();
      if (!location.hash) return false;
      if (focusSection()) return true;
      // Requests and preview sections can arrive after account/catalogue data loads.
      observer = new MutationObserver(() => {
        if (focusSection()) observer?.disconnect();
      });
      if (article.current) observer.observe(article.current, { childList: true, subtree: true });
      return false;
    };
    if (!followHash())
      article.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    window.addEventListener("hashchange", followHash);
    return () => {
      observer?.disconnect();
      window.removeEventListener("hashchange", followHash);
    };
  }, [ready]);
  return article;
}
