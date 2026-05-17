import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import { fetchEvaResource } from "../api/schoolsoft.ts";
import { schedule } from "../lib/fetch-scheduler.ts";

/** Resolved object URLs by resource filename. */
const blobCache = new Map<string, string>();
/** In-flight fetches by resource filename — concurrent callers share the same promise
 *  so a 100-row staff table mounting all at once doesn't double-fetch shared pictures. */
const inflight = new Map<string, Promise<string | null>>();
/** Resources we've already failed to fetch — don't retry. */
const failedCache = new Set<string>();

/** Fetch an auth-gated EVA resource (e.g. an avatar picture) and return a
 *  blob URL once it's loaded. Returns null until the fetch resolves, or
 *  permanently if it fails. */
export function useEvaResourceBlob(picture: string | null | undefined): string | null {
  const { session, getEvaToken } = useAuth();
  const [src, setSrc] = useState<string | null>(() =>
    picture && blobCache.has(picture) ? (blobCache.get(picture) ?? null) : null,
  );
  const aborted = useRef(false);

  useEffect(() => {
    aborted.current = false;
    return () => {
      aborted.current = true;
    };
  }, []);

  useEffect(() => {
    if (!picture || !session) return;
    if (blobCache.has(picture)) {
      setSrc(blobCache.get(picture) ?? null);
      return;
    }
    if (failedCache.has(picture)) {
      setSrc(null);
      return;
    }
    let promise = inflight.get(picture);
    if (!promise) {
      promise = (async () => {
        try {
          const token = await getEvaToken();
          if (!token) {
            failedCache.add(picture);
            return null;
          }
          /* Low priority: lets high-priority data fetches (staff details, etc.)
           * drain the per-origin connection pool first before image bytes. */
          const blob = await schedule("low", () =>
            fetchEvaResource(session.school, token, picture),
          );
          const url = URL.createObjectURL(blob);
          blobCache.set(picture, url);
          return url;
        } catch {
          failedCache.add(picture);
          return null;
        } finally {
          inflight.delete(picture);
        }
      })();
      inflight.set(picture, promise);
    }
    void promise.then((url) => {
      if (!aborted.current && url) setSrc(url);
    });
  }, [picture, session, getEvaToken]);

  return src;
}
