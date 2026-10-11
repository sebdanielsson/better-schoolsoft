import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useUpdateAvailable } from "../lib/app-update.ts";

/** A small pill at the bottom of the screen once a newer deploy is out.
 *  Refreshing loads it: the service worker fetches pages network first. */
export default function UpdateBanner() {
  const available = useUpdateAvailable();
  const [dismissed, setDismissed] = useState(false);
  if (!available || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-1 rounded-full bg-slate-900/90 py-1 pr-1 pl-4 text-[0.85rem] text-white shadow-[var(--shadow-lg)] backdrop-blur">
        <span className="mr-1">New version available</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
