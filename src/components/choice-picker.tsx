import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

/**
 * A single-choice field: a small label over the current value, opening a panel that floats
 * over the content below rather than pushing it down. Escape, a press outside or a choice
 * closes it; focus moves into the panel on open and back to the field on close.
 */
export function ChoicePicker({
  label,
  value,
  active = false,
  align = "start",
  onOpenChange,
  children,
}: {
  label: string;
  value: string;
  /** A choice other than the default is in force. */
  active?: boolean;
  /** Which edge of the field the panel lines up with when it is wider than the field. */
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
  /** The panel content; `choose` closes the panel and returns focus to the field. */
  children: (choose: () => void) => ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const refocus = useRef(false);
  const toggle = (next: boolean, returnFocus = true) => {
    setOpen(next);
    onOpenChange?.(next);
    refocus.current = !next && returnFocus;
    if (refocus.current) field.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) {
      // Again once the panel is gone, in case its removal moved focus away.
      if (refocus.current && document.activeElement !== field.current)
        field.current?.focus({ preventScroll: true });
      refocus.current = false;
      return;
    }
    const node = panel.current;
    node?.scrollIntoView({ block: "nearest" });
    const target =
      node?.querySelector<HTMLElement>("[data-autofocus]") ??
      node?.querySelector<HTMLElement>("input, button, [tabindex='0']");
    target?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) toggle(false, false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  return (
    <div
      class={`choice-picker ${active ? "has-choice" : ""} ${open ? "is-open" : ""}`}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          // Also keeps an enclosing dialog open: Escape closes the panel only.
          event.preventDefault();
          event.stopPropagation();
          toggle(false);
        }
      }}
      onFocusOut={(event) => {
        // Tabbing out of the panel closes it, as a press outside does.
        const next = event.relatedTarget as Node | null;
        if (open && next && !root.current?.contains(next)) toggle(false, false);
      }}
    >
      <button
        type="button"
        class="choice-field"
        ref={field}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => toggle(!open)}
      >
        <span class="choice-label">{label}</span>
        <span class="choice-value" title={value}>
          {value}
        </span>
        <span class="control-caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          class={`choice-panel align-${align}`}
          id={id}
          ref={panel}
          role="dialog"
          aria-label={label}
        >
          {children(() => toggle(false))}
        </div>
      )}
    </div>
  );
}
