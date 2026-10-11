/** Home-screen install support: the service worker registration and the
 *  browser's install prompt. Imported from `main.tsx` before the first
 *  render, because Chromium fires `beforeinstallprompt` only once, early. */

import { useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    /* Keep the event for the Settings menu instead of the browser's own
     * mini-infobar, so installing is offered where people look for it. */
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Register `/sw.js` in production builds. In dev it would cache Vite's
 *  modules and fight hot reload, so dev removes one a production build on
 *  the same origin left behind. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())));
    return;
  }
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Installability is a nicety; the app works without it. */
    });
  };
  /* After first paint, so it doesn't compete with the app's own loading. */
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iPhone and iPad (iPadOS reports itself as a Mac with touch). Safari has
 *  no install prompt there; installing is Share → Add to Home Screen. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** How the app can be installed here: through the browser's prompt, with
 *  manual iOS steps, or not at all (already installed, or unsupported). */
export function useInstall(): { kind: "prompt" | "ios" | null; prompt: () => Promise<void> } {
  const available = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred !== null,
    () => false,
  );
  const kind = isStandalone() ? null : available ? "prompt" : isIos() ? "ios" : null;
  return {
    kind,
    prompt: async () => {
      const e = deferred;
      if (!e) return;
      /* An event can prompt only once; the browser fires a new one later if
       * installing is still possible. */
      deferred = null;
      notify();
      await e.prompt().catch(() => {});
    },
  };
}
