import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import { fetchEvaResource } from "../api/schoolsoft.ts";

/** Cache object URLs across re-mounts so we don't refetch the same image every time. */
const blobCache = new Map<string, string>();
/** Track which resources we've already failed to fetch (so we stop retrying). */
const failedCache = new Set<string>();

/** Fetch an auth-gated EVA resource (e.g. an avatar picture) and return a
 *  blob URL once it's loaded. Returns null until the fetch resolves, or
 *  permanently if it fails. Sharing one module-level cache means multiple
 *  components asking for the same resource only hit the network once. */
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
    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) {
          failedCache.add(picture);
          return;
        }
        const blob = await fetchEvaResource(session.school, token, picture);
        if (aborted.current) return;
        const url = URL.createObjectURL(blob);
        blobCache.set(picture, url);
        setSrc(url);
      } catch {
        failedCache.add(picture);
      }
    })();
  }, [picture, session, getEvaToken]);

  return src;
}
