import { useState } from "react";

const SHOW_LONG_KEY = "bss_schedule_show_long";

/** Whether to show long-running items (term projects and the like), which otherwise
 *  show up every week of the term. Shared by the Schedule and Calendar pages. Remembered per browser. */
export function useShowLongRunning(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(SHOW_LONG_KEY) === "1";
    } catch {
      return false;
    }
  });
  const update = (next: boolean) => {
    setShow(next);
    try {
      if (next) localStorage.setItem(SHOW_LONG_KEY, "1");
      else localStorage.removeItem(SHOW_LONG_KEY);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  };
  return [show, update];
}
