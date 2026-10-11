import type { ComponentChildren } from "preact";

/** Preserve native link behaviour for new tabs and modifier clicks. */
export function PageLink({
  href,
  onNavigate,
  children,
  ...props
}: {
  href: string;
  onNavigate: (path: string) => void;
  children: ComponentChildren;
  class?: string;
  "aria-current"?: "page";
}) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}
