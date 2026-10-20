/**
 * One short confirmation at a time, such as "Film link copied". Any component can call
 * `showToast`; the single `ToastHost` in the app shell listens and shows it.
 */
type Listener = (message: string) => void;
let listener: Listener | null = null;

export function showToast(message: string) {
  listener?.(message);
}

/** Registers the host; returns the function that removes it. */
export function onToast(next: Listener) {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
