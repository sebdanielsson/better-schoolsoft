import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import { fetchEvaResource } from "../api/schoolsoft.ts";

interface AvatarProps {
  name: string;
  /** Resource filename like "teacher9840.jpg" or "student115957.jpg". */
  picture?: string | null;
  size?: number;
  /** Optional click handler. */
  onClick?: () => void;
  title?: string;
}

/** Cache object URLs across re-mounts so we don't refetch the same image every time. */
const blobCache = new Map<string, string>();
/** Track which images we've already failed to fetch (so we stop retrying). */
const failedCache = new Set<string>();

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase().slice(0, 2) || "?";
}

/** Map a string to a stable, pleasing HSL hue. */
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 65% 60%) 0%, hsl(${(hue + 30) % 360} 60% 45%) 100%)`;
}

export default function Avatar({ name, picture, size = 44, onClick, title }: AvatarProps) {
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

  const dim = `${size}px`;
  const fontSize = `${Math.max(11, Math.floor(size * 0.4))}px`;

  return (
    <div
      className={`avatar ${onClick ? "avatar-clickable" : ""}`}
      style={{
        width: dim,
        height: dim,
        background: src ? "var(--color-bg)" : colorFromName(name),
        fontSize,
      }}
      onClick={onClick}
      title={title ?? name}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {src ? (
        <img className="avatar-img" alt={name} src={src} />
      ) : (
        <span className="avatar-initials">{initials(name)}</span>
      )}
    </div>
  );
}
