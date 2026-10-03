import { useEffect, useState } from "react";

/** Current time in epoch millis, refreshed every `intervalMs`. Lets render
 *  logic depend on "now" (e.g. whether a lesson has started) without calling
 *  `Date.now()` during render. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
