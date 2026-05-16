/** Two-letter initials for the avatar fallback (e.g. "Anna Smith" → "AS"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase().slice(0, 2) || "?";
}

/** Map a string to a stable, pleasing HSL gradient used as the fallback bg. */
export function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 65% 60%) 0%, hsl(${(hue + 30) % 360} 60% 45%) 100%)`;
}
