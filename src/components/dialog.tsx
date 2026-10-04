import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
export function Dialog({
  open,
  title,
  onClose,
  children,
  restoreTo,
  focusKey = "",
  className = "account-dialog",
}: {
  className?: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Fallback focus target when the opener is gone, e.g. a closed phone drawer. */
  restoreTo?: () => HTMLElement | null;
  /** Changing this while open moves focus to the current initial element (e.g. a confirmation view). */
  focusKey?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const restore = useRef(restoreTo);
  restore.current = restoreTo;
  useEffect(() => {
    const node = ref.current!;
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!node.open) node.showModal();
    node.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      if (node.open) node.close();
      const target =
        previous?.isConnected && previous.getClientRects().length ? previous : restore.current?.();
      target?.focus();
    };
  }, [open]);
  useEffect(() => {
    if (open && focusKey) ref.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
  }, [open, focusKey]);
  return (
    <dialog
      ref={ref}
      class={className}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClose={() => {
        if (open) close.current();
      }}
      onClick={(event) => {
        if (event.target === ref.current) close.current();
      }}
    >
      <div class="sheet-heading">
        <h2>{title}</h2>
        <button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
          ×
        </button>
      </div>
      <div class="account-dialog-body">{open && children}</div>
    </dialog>
  );
}
