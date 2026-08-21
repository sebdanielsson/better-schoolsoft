import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { fetchEvaStaff, type EvaStaffGroup, type EvaStaffMember } from "../api/schoolsoft.ts";
import Avatar from "../components/Avatar.tsx";
import StaffPopover from "../components/StaffPopover.tsx";
import { preloadStaffDetail, staffDetailCache } from "../lib/staff-cache.ts";
import { Input } from "../components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.tsx";
import { cn } from "../lib/utils.ts";

/* Stable colour per group type. Keeps "Lärare" amber etc. across reloads — chosen
 * to roughly match the dashboard accent vocabulary without clashing with the news palette. */
const TYPE_COLORS: Record<string, string> = {
  Lärare: "#2563eb",
  Skolledare: "#f59e0b",
  "Övrig personal": "#64748b",
  Elevvårdare: "#16a34a",
};

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#0ea5e9";
}

function fullName(m: EvaStaffMember): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

export default function StaffPage() {
  const { session, getEvaToken } = useAuth();
  const [groups, setGroups] = useState<EvaStaffGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set());
  /* Bumped (throttled) as staff details land so the Roles column / dropdown fill
   * in progressively. The cache itself lives in staff-cache; this is just a
   * "something changed, re-render" pulse. */
  const [detailsTick, setDetailsTick] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const staffParam = searchParams.get("staff");
  const selectedTeacherId = staffParam ? Number(staffParam) : null;

  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const scheduleRefresh = () => {
      if (cancelled || refreshTimer.current !== null) return;
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        if (!cancelled) setDetailsTick((t) => t + 1);
      }, 200);
    };

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("No access token available");
        const data = await fetchEvaStaff(session.school, token, session.orgId);
        if (cancelled) return;
        /* Queue all detail preloads BEFORE setGroups commits. Once committed,
         * the Avatar components mount and start queueing their resource fetches
         * at "low" priority — by then the scheduler's high-priority queue is
         * already filled, so details drain ahead of avatars. */
        for (const group of data ?? []) {
          for (const m of group.data) {
            preloadStaffDetail(session.school, token, session.orgId, m.teacherId)
              .then(scheduleRefresh)
              .catch(() => {
                /* swallow per-teacher failures — the popover will retry on demand */
              });
          }
        }
        setGroups(data ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load staff");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [session, getEvaToken]);

  /* Union of every role ever seen in the cache, sorted. Recomputes on detailsTick
   * so the dropdown fills in as preloads land. */
  const allRoles = useMemo(() => {
    const set = new Set<string>();
    for (const d of staffDetailCache.values()) {
      for (const r of d.roles ?? []) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
    /* detailsTick is a change signal, not a value the memo reads: staffDetailCache is a
     * module-level Map filled by background preloads, so the tick is what tells React the
     * derived value is stale. Dropping it (as the rule suggests) freezes the roles dropdown
     * at whatever had loaded on first render. Fixing it properly means moving the cache into
     * state, which is a refactor of this page rather than a lint fix. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsTick]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteringByRole = activeRoles.size > 0;
    return groups
      .map((g) => ({
        type: g.type,
        data: g.data.filter((m) => {
          if (q && !fullName(m).toLowerCase().includes(q)) return false;
          if (filteringByRole) {
            const roles = staffDetailCache.get(m.teacherId)?.roles ?? [];
            if (!roles.some((r) => activeRoles.has(r))) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.data.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note on allRoles above
  }, [groups, query, activeRoles, detailsTick]);

  const totalShown = visibleGroups.reduce((n, g) => n + g.data.length, 0);
  const totalAll = groups.reduce((n, g) => n + g.data.length, 0);

  function toggleRole(role: string, checked: boolean) {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  function openMember(id: number) {
    const next = new URLSearchParams(searchParams);
    next.set("staff", String(id));
    setSearchParams(next, { replace: false });
  }

  function closeMember() {
    const next = new URLSearchParams(searchParams);
    next.delete("staff");
    setSearchParams(next, { replace: true });
  }

  if (loading)
    return (
      <div className="px-8 py-16 text-center text-[0.95rem] text-slate-500">Loading staff…</div>
    );
  if (error)
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Staff</h2>
        <span className="text-[0.85rem] text-slate-500">
          {totalShown === totalAll
            ? `${totalAll} ${totalAll === 1 ? "person" : "people"}`
            : `${totalShown} of ${totalAll}`}
        </span>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search by name…"
            className="pl-9"
            aria-label="Search staff by name"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
              }}
              className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[0.85rem] font-medium text-slate-700 transition-colors",
              "hover:border-slate-300 hover:bg-slate-50",
              "data-popup-open:border-slate-300 data-popup-open:bg-slate-50",
              activeRoles.size > 0 && "border-blue-300 text-blue-700",
            )}
          >
            <span>Roles</span>
            {activeRoles.size > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[0.68rem] leading-[1.4] font-semibold text-white">
                {activeRoles.size}
              </span>
            )}
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[420px] w-[260px] overflow-y-auto">
            {activeRoles.size > 0 && (
              <>
                <DropdownMenuLabel className="flex items-center justify-between gap-3 py-1.5 tracking-normal normal-case">
                  <span className="text-[0.72rem] font-semibold tracking-wider text-slate-500 uppercase">
                    {activeRoles.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoles(new Set());
                    }}
                    className="text-[0.78rem] font-medium text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            {allRoles.length === 0 ? (
              <div className="px-2 py-2 text-sm text-slate-500">Loading roles…</div>
            ) : (
              allRoles.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={activeRoles.has(role)}
                  onCheckedChange={(checked) => {
                    toggleRole(role, Boolean(checked));
                  }}
                  /* Keep the menu open so users can flip several roles in one go. */
                  closeOnClick={false}
                  /* Override the shadcn defaults that uppercase + wide-track everything —
                   * role labels like "HoY" or "Mentor Yr4" carry case information we need. */
                  className="text-[0.85rem] font-normal tracking-normal normal-case"
                >
                  {role}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {totalShown === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
          {activeRoles.size > 0 || query ? "No staff match your filters." : "No staff to display."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">{""}</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleGroups.map((g) => (
                <GroupBlock
                  key={g.type}
                  type={g.type}
                  color={typeColor(g.type)}
                  members={g.data}
                  onOpen={openMember}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StaffPopover
        open={selectedTeacherId !== null}
        teacherId={selectedTeacherId}
        onClose={closeMember}
      />
    </div>
  );
}

interface GroupBlockProps {
  type: string;
  color: string;
  members: EvaStaffMember[];
  onOpen: (id: number) => void;
}

function GroupBlock({ type, color, members, onOpen }: GroupBlockProps) {
  return (
    <>
      <TableRow className="bg-slate-50 hover:bg-slate-50">
        <TableCell colSpan={3} className="py-2">
          <div className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.06em] text-slate-500 uppercase">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            {type}
            <span className="font-normal tracking-normal text-slate-400 normal-case">
              · {members.length}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {members.map((m) => (
        <StaffRow key={m.teacherId} member={m} onOpen={onOpen} />
      ))}
    </>
  );
}

function StaffRow({ member, onOpen }: { member: EvaStaffMember; onOpen: (id: number) => void }) {
  /* Read straight from the cache. The parent re-renders (via detailsTick) as
   * preloads land, which drags this row's read along with it — no per-row
   * subscription needed. */
  const roles = staffDetailCache.get(member.teacherId)?.roles ?? [];
  return (
    <TableRow
      onClick={() => {
        onOpen(member.teacherId);
      }}
      className="cursor-pointer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(member.teacherId);
        }
      }}
    >
      <TableCell>
        <Avatar name={fullName(member)} picture={member.picture || null} size={32} />
      </TableCell>
      <TableCell className="font-medium text-slate-900">{fullName(member)}</TableCell>
      <TableCell className="hidden whitespace-normal sm:table-cell">
        {roles.length === 0 ? (
          <span className="text-[0.85rem] text-slate-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <span
                key={r}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.75rem] font-medium text-slate-700"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
