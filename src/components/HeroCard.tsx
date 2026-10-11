import { useAuth } from "../hooks/useAuth.tsx";
import { useNow } from "../hooks/useNow.ts";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useEvaResourceBlob } from "../hooks/useEvaResourceBlob.tsx";

import { colorFromName, initials } from "../lib/avatar-helpers.ts";
import SettingsPill from "./SettingsPill.tsx";
import NotificationCenter from "./NotificationCenter.tsx";
import ChildSwitcher from "./ChildSwitcher.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";
import { isoWeek } from "../lib/dates.ts";

/** Visual treatment shared by guardian + student avatars in the hero banner.
 * 40px on mobile, 48px from sm up; ring + soft shadow for presence. The
 * `after:hidden` neutralises shadcn's default subtle border so our ring is
 * the only visible outline. */
const heroAvatarClass =
  "size-10 sm:size-12 rounded-full ring-2 ring-white/35 shadow-[0_6px_18px_rgba(0,0,0,0.18)] shrink-0 after:hidden overflow-hidden";
const heroAvatarFallbackClass =
  "text-[0.85rem] sm:text-[19px] font-bold tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]";

export default function HeroCard() {
  const { session } = useAuth();
  const { child } = useHeroData();
  const childPictureSrc = useEvaResourceBlob(child?.picture);

  /* Ticks once a minute so the displayed date/week stay accurate across a long session. */
  const today = useNow();
  const todayWeek = isoWeek(today);

  if (!session) return null;

  const displayName = child ? `${child.firstName} ${child.lastName}` : session.name;
  const isGuardian = session.userType === "2";

  return (
    <section className="relative mb-6 grid grid-cols-2 items-center gap-x-4 gap-y-3 overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#1e40af_0%,#2563eb_50%,#3b82f6_100%)] p-6 text-white shadow-[var(--shadow-lg)] md:gap-x-8 md:gap-y-4 md:px-8 md:py-7">
      {/* Decorative circles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[80px] -right-[50px] h-[240px] w-[240px] rounded-full bg-white/[0.08]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-20 -bottom-[100px] h-[200px] w-[200px] rounded-full bg-white/[0.05]"
      />

      {/* Row 1: date + week, centered in the top padding area. */}
      <span className="relative z-[1] col-span-2 text-center text-xs opacity-85 sm:text-sm">
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
        <h1 className="m-0 min-w-0 text-base leading-[1.1] font-bold tracking-[-0.02em] sm:text-[1.2rem] md:text-[1.6rem]">
          {session.name}
        </h1>
      </div>

      {/* Row 2 col 2: student — avatar above name on mobile, name + avatar from md.
       * Always rendered for guardians so the card height doesn't pop when data arrives. */}
      {isGuardian && (
        <div className="relative z-[1] flex flex-col-reverse items-center gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-[0.6rem]">
          <span className="min-w-0 text-right text-base leading-[1.1] font-bold tracking-[-0.02em] sm:text-[1.2rem] md:min-w-[9rem] md:text-[1.6rem]">
            {child ? (
              <ChildSwitcher />
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

      {/* Row 3: what's-new + settings span both columns, right-aligned. */}
      {isGuardian && (
        <div className="relative z-[1] col-span-2 flex flex-wrap justify-end gap-[0.4rem]">
          <NotificationCenter />
          <SettingsPill />
        </div>
      )}
    </section>
  );
}
