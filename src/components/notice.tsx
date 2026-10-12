import type { ComponentChildren } from "preact";

export function Notice({
  kind,
  title,
  children,
  actions,
  className = "",
  heading = false,
}: {
  kind: "error" | "status" | "success";
  title: string;
  children: ComponentChildren;
  actions?: ComponentChildren;
  className?: string;
  heading?: boolean;
}) {
  return (
    <div class={`notice notice-${kind} ${className}`} role={kind === "error" ? "alert" : "status"}>
      <strong
        class="notice-title"
        role={heading ? "heading" : undefined}
        aria-level={heading ? 2 : undefined}
      >
        {title}
      </strong>
      <div class="notice-copy">{children}</div>
      {actions && <div class="notice-actions">{actions}</div>}
    </div>
  );
}
