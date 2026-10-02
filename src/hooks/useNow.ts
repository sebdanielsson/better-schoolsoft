import { useEffect, useState } from "react";

/**
 * The current time as React state. `new Date()` is impure, so it cannot be read
 * during render; this hook reads it once for the initial render and then
 * refreshes it on an interval so time-derived UI (week number, "today") stays
 * correct across a long session.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
