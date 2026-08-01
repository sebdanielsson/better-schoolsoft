import { useEffect, useState } from "react";
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
  /* Stored together with the picture it belongs to, not as a bare URL. Reading
   * it back below is then conditional on that picture still being the requested
   * one, which makes showing a stale avatar structurally impossible: clearing
   * on `picture` changing to null, to an uncached value, or to one whose fetch
   * fails all fall out of the same check instead of needing an explicit reset
   * on every early return — one of which was previously missing. */
  const [resolved, setResolved] = useState<{ picture: string; url: string } | null>(() => {
    const cached = picture ? blobCache.get(picture) : undefined;
    return picture && cached ? { picture, url: cached } : null;
  });

  useEffect(() => {
    /* Scoped to this effect run rather than held in a ref, so a response is
     * discarded whenever *its* run is superseded — not only on unmount. A
     * component-lifetime `aborted` ref cannot express that, which is how a slow
     * fetch for a previous `picture` used to land after a fast one for the
     * current picture and paint the wrong avatar. */
    let cancelled = false;
    if (!picture || !session) return;

    const cached = blobCache.get(picture);
    if (cached) {
      setResolved({ picture, url: cached });
      return;
    }
    if ((failedAttempts.get(picture) ?? 0) >= MAX_ATTEMPTS) return;

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
      if (!cancelled && url) setResolved({ picture, url });
    });

    return () => {
      cancelled = true;
    };
  }, [picture, session, getEvaToken]);

  /* Only surface a URL that belongs to the picture being asked for right now. */
  return resolved && resolved.picture === picture ? resolved.url : null;
}
