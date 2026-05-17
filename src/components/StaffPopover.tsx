import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import Avatar from "./Avatar.tsx";
import { Dialog, DialogContent } from "./ui/dialog.tsx";
import { useAuth } from "../hooks/useAuth.tsx";
import { type EvaStaffDetail } from "../api/schoolsoft.ts";
import { preloadStaffDetail, staffDetailCache } from "../lib/staff-cache.ts";

/* Same palette as the StaffPage chips so the avatar header colour matches the group. */
const TYPE_COLORS: Record<string, string> = {
  Lärare: "#2563eb",
  Skolledare: "#f59e0b",
  "Övrig personal": "#64748b",
  Elevvårdare: "#16a34a",
};

function typeColor(type: string | undefined): string {
  if (!type) return "#64748b";
  return TYPE_COLORS[type] ?? "#0ea5e9";
}

interface Props {
  /** Reflects intent from the URL (`?staff=ID`). The dialog only actually
   *  becomes visible once the detail is in the cache so the open animation
   *  always plays on final content (no skeleton, no mid-animation reflow). */
  open: boolean;
  teacherId: number | null;
  onClose: () => void;
}

export default function StaffPopover({ open, teacherId, onClose }: Props) {
  const { session, getEvaToken } = useAuth();
  const [detail, setDetail] = useState<EvaStaffDetail | null>(() =>
    teacherId !== null ? (staffDetailCache.get(teacherId) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || teacherId === null || !session) {
      setError(null);
      return;
    }
    /* Hit (the common case after StaffPage's preload pass): paint instantly. */
    const cached = staffDetailCache.get(teacherId);
    if (cached) {
      setDetail(cached);
      setError(null);
      return;
    }
    /* Miss (deep-link with ?staff=ID, or click during the preload pass): fetch
     * on demand at high priority, then flip the dialog visible. */
    let cancelled = false;
    setDetail(null);
    setError(null);
    (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("No access token");
        const data = await preloadStaffDetail(session.school, token, session.orgId, teacherId);
        if (cancelled) return;
        setDetail(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load details");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teacherId, session, getEvaToken]);

  if (teacherId === null) return null;

  /* Gate the dialog's `open` on data being ready: when there's no detail yet,
   * we don't render the popover at all. The user sees nothing happen for the
   * brief moment between click and detail-arrived, then the popover animates
   * in once with the real content. Errors short-circuit the gate so the user
   * still gets feedback when the fetch fails. */
  const ready = detail !== null || error !== null;
  const dialogOpen = open && ready;

  const name = detail
    ? `${detail.firstName} ${detail.lastName}`.trim() || "Staff member"
    : "Staff member";
  const color = typeColor(detail?.type);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="p-0 gap-0 rounded-2xl bg-white text-slate-900 max-w-[560px] sm:max-w-[560px] max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden"
        aria-labelledby="staff-popover-title"
      >
        <div className="flex items-start gap-4 pt-6 pr-[3.25rem] pb-5 pl-7 border-b border-slate-200 shrink-0">
          <Avatar name={name} picture={detail?.picture || null} size={64} />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="staff-popover-title"
              className="text-[1.4rem] font-bold leading-[1.2] tracking-[-0.01em] m-0 text-slate-900 break-words"
            >
              {name}
            </h2>
            {detail?.type && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold tracking-[0.01em]"
                  style={{ background: `${color}1f`, color }}
                >
                  {detail.type}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-5 overflow-y-auto flex-1 min-h-0 flex flex-col gap-5">
          {error && (
            <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {detail?.roles && detail.roles.length > 0 && (
            <Section label="Roles">
              <div className="flex flex-wrap gap-1.5">
                {detail.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.78rem] font-medium text-slate-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {(detail?.email || detail?.mobile) && (
            <Section label="Contact">
              <div className="flex flex-col gap-2">
                {detail.email && (
                  <a
                    href={`mailto:${detail.email}`}
                    className="inline-flex items-center gap-2.5 text-[0.92rem] text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="break-all">{detail.email}</span>
                  </a>
                )}
                {detail.mobile && (
                  <a
                    href={`tel:${detail.mobile.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2.5 text-[0.92rem] text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span>{detail.mobile}</span>
                  </a>
                )}
              </div>
            </Section>
          )}

          {detail?.contactInfo && detail.contactInfo.trim() && (
            <Section label="About">
              <p className="whitespace-pre-wrap text-[0.92rem] leading-[1.55] text-slate-700">
                {detail.contactInfo}
              </p>
            </Section>
          )}

          {detail &&
            !detail.email &&
            !detail.mobile &&
            !(detail.roles && detail.roles.length) &&
            !(detail.contactInfo && detail.contactInfo.trim()) && (
              <div className="text-sm italic text-slate-500">No contact details published.</div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}
