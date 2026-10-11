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
    if (!focusSection())
      article.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    window.addEventListener("hashchange", focusSection);
    return () => window.removeEventListener("hashchange", focusSection);
  }, [ready]);
  return article;
}
