import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { onToast } from "../lib/toast";
import { CheckIcon } from "./platform-marks";

const SHOWN_FOR = 3000;

/**
 * The open modal dialog on top, if any. A modal dialog sits in the browser's top layer and
 * makes the rest of the page inert, so a toast outside it would be hidden behind it or kept
 * from screen readers; the toast is rendered inside it instead.
 */
function topDialog() {
  const modal = (dialog: HTMLDialogElement) => {
    try {
      return dialog.matches(":modal");
    } catch {
      // Without :modal support, every open dialog here was opened with showModal.
      return true;
    }
  };
  const open = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter(modal);
  return open.at(-1) ?? null;
}

/**
 * Renders the toast `showToast` asks for: bottom centre, three seconds, a new message
 * replacing the old one. Pointer hover or keyboard focus inside it holds it on screen.
 */
export function ToastHost() {
  const [message, setMessage] = useState("");
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const timer = useRef<number>(0);
  const frame = useRef<number>(0);
  const held = useRef(false);
  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!held.current) setMessage("");
    }, SHOWN_FOR);
  };
  useEffect(
    () =>
      onToast((next) => {
        window.clearTimeout(timer.current);
        window.cancelAnimationFrame(frame.current);
        // Clear, then set on the next frame, so the same message is announced again.
        setMessage("");
        setContainer(topDialog());
        frame.current = window.requestAnimationFrame(() => {
          setMessage(next);
          start();
        });
      }),
    [],
  );
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.cancelAnimationFrame(frame.current);
    },
    [],
  );
  const hold = (value: boolean) => {
    held.current = value;
    if (value) window.clearTimeout(timer.current);
    else if (message) start();
  };
  const toast = (
    <div
      class={`toast ${message ? "is-shown" : ""}`}
      role="status"
      aria-live="polite"
      onPointerEnter={() => hold(true)}
      onPointerLeave={() => hold(false)}
      onFocusIn={() => hold(true)}
      onFocusOut={() => hold(false)}
    >
      {message && (
        <>
          <CheckIcon />
          <span>{message}</span>
        </>
      )}
    </div>
  );
  return container?.isConnected && container.open ? createPortal(toast, container) : toast;
}
