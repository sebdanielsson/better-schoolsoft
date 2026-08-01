import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import { fetchEvaResource } from "../api/schoolsoft.ts";
import { schedule } from "../lib/fetch-scheduler.ts";
import { registerSessionCache } from "../lib/session-caches.ts";

/** Resolved object URLs by resource filename. */
const blobCache = new Map<string, string>();
/** In-flight fetches by resource filename — concurrent callers share the same promise
 *  so a 100-row staff table mounting all at once doesn't double-fetch shared pictures. */
const inflight = new Map<string, Promise<string | null>>();
/** Failed fetch attempts by resource filename. Counted rather than latched: a
 *  single network blip shouldn't blank an avatar for the lifetime of the tab. */
const failedAttempts = new Map<string, number>();

/** Give up on a picture after this many failed fetches. */
const MAX_ATTEMPTS = 3;

/* Blob URLs pin their backing Blob in memory until revoked, and the cache keys
 * are not scoped by school — so both leak across a logout without this. */
registerSessionCache(() => {
  for (const url of blobCache.values()) URL.revokeObjectURL(url);
  blobCache.clear();
  failedAttempts.clear();
  inflight.clear();
});

/** Fetch an auth-gated EVA resource (e.g. an avatar picture) and return a
 *  blob URL once it's loaded. Returns null until the fetch resolves, or
 *  permanently if it fails `MAX_ATTEMPTS` times. */
export function useEvaResourceBlob(picture: string | null | undefined): string | null {
  const { session, getEvaToken } = useAuth();
  const [src, setSrc] = useState<string | null>(() =>
    picture && blobCache.has(picture) ? (blobCache.get(picture) ?? null) : null,
  );
  /* Monotonic id of the newest effect run. A response is only applied if its
   * run is still the current one — otherwise a slow fetch for a previous
   * `picture` would land after a fast one for the current picture and paint
   * the wrong avatar. A single boolean `aborted` ref cannot express this,
   * because unmount is not the only reason a response goes stale. */
  const runId = useRef(0);

  useEffect(() => {
    const run = ++runId.current;
    if (!picture || !session) return;

    if (blobCache.has(picture)) {
      setSrc(blobCache.get(picture) ?? null);
      return;
    }
    if ((failedAttempts.get(picture) ?? 0) >= MAX_ATTEMPTS) {
      setSrc(null);
      return;
    }

    let promise = inflight.get(picture);
    if (!promise) {
      promise = (async () => {
        try {
          const token = await getEvaToken();
          /* No token yet (Eva sign-in not finished, or a refresh failed) is a
           * transient condition — return without recording an attempt so the
           * avatar still loads once the session is established. */
          if (!token) return null;
          /* Low priority: lets high-priority data fetches (staff details, etc.)
           * drain the per-origin connection pool first before image bytes. */
          const blob = await schedule("low", () =>
            fetchEvaResource(session.school, token, picture),
          );
          const url = URL.createObjectURL(blob);
          blobCache.set(picture, url);
          failedAttempts.delete(picture);
          return url;
        } catch {
          failedAttempts.set(picture, (failedAttempts.get(picture) ?? 0) + 1);
          return null;
        } finally {
          inflight.delete(picture);
        }
      })();
      inflight.set(picture, promise);
    }

    void promise.then((url) => {
      if (runId.current === run && url) setSrc(url);
    });

    return () => {
      /* Invalidate this run so a late response can't overwrite a newer one. */
      runId.current++;
    };
  }, [picture, session, getEvaToken]);

  return src;
}
