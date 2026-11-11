import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * The current time, moved on once a minute and on returning to the foreground, so "next
 * screening" lines drop screenings that have started. One minute is the website's refilter
 * interval for the same lines.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}
