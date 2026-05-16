import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useEvaResourceBlob } from "../hooks/useEvaResourceBlob.tsx";
import { isoWeek } from "../api/schoolsoft.ts";
import { colorFromName, initials } from "../lib/avatar-helpers.ts";
import SettingsPill from "./SettingsPill.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

const counterPillBase =
  "flex items-center justify-center gap-1 rounded-full pl-[0.3rem] pr-[0.5rem] py-[0.15rem] text-[11px] font-medium text-inherit no-underline backdrop-blur-[4px] bg-white/15 " +
  "basis-[calc(50%-0.2rem)] grow-0 shrink-0 sm:basis-auto " +
  "sm:gap-1.5 sm:pl-[0.4rem] sm:pr-[0.6rem] sm:py-1 sm:text-xs";
const counterPillActive = "!bg-white !text-[var(--color-primary)] font-semibold";
const counterPillLoading = "!bg-white/10";
const counterPillBadge =
  "inline-flex items-center justify-center min-w-[1.2rem] h-[1.2rem] sm:min-w-[1.4rem] sm:h-[1.4rem] px-[0.4em] rounded-full font-bold";
const counterPillBadgeSkeleton =
  "min-w-[1.2rem] w-[1.2rem] h-[1.2rem] sm:min-w-[1.4rem] sm:w-[1.4rem] sm:h-[1.4rem] rounded-full !bg-white/55 shrink-0";

/** Visual treatment shared by guardian + student avatars in the hero banner.
 * 40px on mobile, 48px from sm up; ring + soft shadow for presence. The
 * `after:hidden` neutralises shadcn's default subtle border so our ring is
 * the only visible outline. */
const heroAvatarClass =
  "size-10 sm:size-12 rounded-full ring-2 ring-white/35 shadow-[0_6px_18px_rgba(0,0,0,0.18)] shrink-0 after:hidden overflow-hidden";
const heroAvatarFallbackClass =
  "text-[0.85rem] sm:text-[19px] font-bold tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]";

function CounterPill({
  label,
  value,
  to,
  loading = false,
  tone = "default",
}: {
  label: string;
  value: number;
  to?: string;
  loading?: boolean;
  tone?: "default" | "alert";
}) {
  const isActive = !loading && value > 0;
  const valueBg = isActive
    ? tone === "alert"
      ? "bg-[var(--color-error)] text-white"
      : "bg-[var(--color-primary)] text-white"
    : "bg-white/30 text-inherit";

  const content = (
    <>
      {loading ? (
        <Skeleton className={counterPillBadgeSkeleton} aria-hidden="true" />
      ) : (
        <span className={cn(counterPillBadge, valueBg)}>{value}</span>
      )}
      <span className={cn("whitespace-nowrap", loading && "text-white/70")}>{label}</span>
    </>
  );

  const className = cn(
    counterPillBase,
    isActive && counterPillActive,
    loading && counterPillLoading,
  );

  if (to && !loading) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

export default function HeroCard() {
  const { session } = useAuth();
  const { child, unread, badges, loading } = useHeroData();
  const childPictureSrc = useEvaResourceBlob(child?.picture);

  /* Re-render once a minute so the displayed date/week stay accurate across a long session. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayWeek = isoWeek(today);

  if (!session) return null;

  const displayName = child ? `${child.firstName} ${child.lastName}` : session.name;
  const childClass = child?.schools[0]?.className;
  const isGuardian = session.userType === "2";

  return (
    <section className="relative overflow-hidden mb-6 rounded-[18px] text-white shadow-[var(--shadow-lg)] bg-[linear-gradient(135deg,#1e40af_0%,#2563eb_50%,#3b82f6_100%)] p-6 md:py-7 md:px-8 grid grid-cols-2 items-center gap-x-4 gap-y-3 md:gap-x-8 md:gap-y-4">
      {/* Decorative circles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[50px] -top-[80px] w-[240px] h-[240px] rounded-full bg-white/[0.08]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[100px] right-20 w-[200px] h-[200px] rounded-full bg-white/[0.05]"
      />

      {/* Row 1: date + week, centered in the top padding area. */}
      <span className="relative z-[1] col-span-2 text-xs opacity-85 text-center sm:text-sm">
        {today.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        <span aria-hidden="true" className="mx-[0.35em]">
          ·
        </span>
        Week {todayWeek}
      </span>

      {/* Row 2 col 1: guardian — avatar above name on mobile, side by side from md. */}
      <div className="relative z-[1] flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-[0.7rem]">
        <Avatar className={heroAvatarClass}>
          <AvatarFallback
            className={heroAvatarFallbackClass}
            style={{ background: colorFromName(session.name) }}
          >
            {initials(session.name)}
          </AvatarFallback>
        </Avatar>
        <h1 className="m-0 text-base sm:text-[1.2rem] md:text-[1.6rem] font-bold tracking-[-0.02em] leading-[1.1] min-w-0">
          {session.name}
        </h1>
      </div>

      {/* Row 2 col 2: student — avatar above name on mobile, name + avatar from md.
       * Always rendered for guardians so the card height doesn't pop when data arrives. */}
      {isGuardian && (
        <div className="relative z-[1] flex flex-col-reverse items-center gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-[0.6rem]">
          <span className="text-base sm:text-[1.2rem] md:text-[1.6rem] font-bold tracking-[-0.02em] leading-[1.1] text-right min-w-0 md:min-w-[9rem]">
            {child ? (
              <>
                {child.firstName}
                {childClass ? ` · ${childClass}` : ""}
              </>
            ) : (
              /* Non-breaking space preserves the line-box so the row keeps the
               * same height as when it contains the child's first name + class. */
              " "
            )}
          </span>
          {child ? (
            <Avatar className={heroAvatarClass}>
              {childPictureSrc && <AvatarImage src={childPictureSrc} alt={displayName} />}
              <AvatarFallback
                className={heroAvatarFallbackClass}
                style={{ background: colorFromName(displayName) }}
              >
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Skeleton className={cn(heroAvatarClass, "!bg-white/20")} aria-hidden="true" />
          )}
        </div>
      )}

      {/* Row 3: counter pills + settings span both columns, right-aligned. */}
      {isGuardian && (
        <div className="relative z-[1] col-span-2 flex flex-wrap justify-end gap-[0.4rem]">
          <CounterPill
            label={`Unread ${unread === 1 ? "message" : "messages"}`}
            value={unread}
            to="/messages"
            loading={loading}
            tone="alert"
          />
          <CounterPill label="Subject rooms" value={badges.subjectrooms ?? 0} loading={loading} />
          <CounterPill label="Bookings" value={badges.bookings ?? 0} loading={loading} />
          <SettingsPill />
        </div>
      )}
    </section>
  );
}
