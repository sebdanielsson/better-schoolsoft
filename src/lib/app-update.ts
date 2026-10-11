/** Notices a newer deploy while the app is running. An installed app resumed
 *  from the background keeps the code it started with, so on every return to
 *  the foreground (and now and then while open) it compares its build id with
 *  the one in `/version.json`. Both are written by the `app-version` plugin in
 *  `vite.config.ts`. */

import { useSyncExternalStore } from "react";

/** Checks closer together than this are skipped: returning to the app fires
 *  several events at once (`visibilitychange`, `pageshow`, `online`). */
export const MIN_INTERVAL_MS = 10_000;
/** How often to check while the app stays open and visible. */
export const POLL_INTERVAL_MS = 30 * 60_000;

export interface UpdateChecker {
  /** Fetch the deployed version unless one was checked recently or an update
   *  was already found. Never throws: offline just means no news. */
  check(): Promise<void>;
  available(): boolean;
  subscribe(listener: () => void): () => void;
}

export function createUpdateChecker({
  current,
  fetchVersion,
  now = Date.now,
}: {
  current: string;
  fetchVersion: () => Promise<string | null>;
  now?: () => number;
}): UpdateChecker {
  let found = false;
  let last = -Infinity;
  const listeners = new Set<() => void>();
  return {
    async check() {
      if (found || now() - last < MIN_INTERVAL_MS) return;
      last = now();
      const deployed = await fetchVersion().catch(() => null);
      if (deployed && deployed !== current && !found) {
        found = true;
        listeners.forEach((l) => l());
      }
    },
    available: () => found,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function fetchDeployedVersion(): Promise<string | null> {
  const res = await fetch("/version.json", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { version?: unknown };
  return typeof body.version === "string" ? body.version : null;
}

/** Null outside production builds, which carry no version stamp. */
const checker: UpdateChecker | null = (() => {
  if (typeof document === "undefined") return null;
  const current = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content;
  return current ? createUpdateChecker({ current, fetchVersion: fetchDeployedVersion }) : null;
})();

/** Start checking: now, on every return to the foreground, and on a timer
 *  while visible. Also asks the browser to look for a new service worker,
 *  which it otherwise does only on navigation, and a resumed app doesn't
 *  navigate. */
export function watchForUpdates(): void {
  if (!checker) return;
  const run = () => {
    if (document.visibilityState !== "visible") return;
    void checker.check();
    void navigator.serviceWorker
      ?.getRegistration()
      .then((r) => r?.update())
      .catch(() => {});
  };
  document.addEventListener("visibilitychange", run);
  window.addEventListener("pageshow", run);
  window.addEventListener("online", run);
  setInterval(run, POLL_INTERVAL_MS);
  run();
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (cb) => checker?.subscribe(cb) ?? (() => {}),
    () => checker?.available() ?? false,
    () => false,
  );
}
