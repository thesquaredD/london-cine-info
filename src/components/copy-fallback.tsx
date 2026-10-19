import { useEffect, useRef } from "preact/hooks";

/**
 * Shown when the clipboard refuses a share: the link, focused and selected so the reader can
 * copy it at once, with Done (or Escape) to put it away. A later copy that works also clears
 * it. It does not vanish on blur: removing it while the pointer is down on the next button
 * would move that button out from under the click.
 */
export function CopyFallback({
  label,
  value,
  onDismiss,
}: {
  label: string;
  value: string;
  onDismiss: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  // The Share button that was pressed; focus goes back to it when the field is put away.
  const opener = useRef<HTMLElement | null>(null);
  const dismiss = () => {
    onDismiss();
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (document.activeElement !== field.current)
      opener.current = document.activeElement as HTMLElement | null;
    field.current?.focus({ preventScroll: true });
    field.current?.select();
  }, [value]);
  return (
    <span class="share-fallback">
      <input
        ref={field}
        aria-label={label}
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}
      />
      <button type="button" onClick={dismiss}>
        Done
      </button>
    </span>
  );
}
