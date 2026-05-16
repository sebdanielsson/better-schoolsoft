import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { isoWeek } from "../api/schoolsoft.ts";
import Avatar from "./Avatar.tsx";
import SettingsPill from "./SettingsPill.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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
  const content = (
    <>
      {loading ? (
        <Skeleton className="counter-pill-skeleton-value" aria-hidden="true" />
      ) : (
        <span className="counter-pill-value">{value}</span>
      )}
      <span className="counter-pill-label">{label}</span>
    </>
  );
  const className = `counter-pill ${!loading && value > 0 ? "is-active" : ""} ${
    loading ? "counter-pill--loading" : ""
  } ${tone === "alert" ? "counter-pill--alert" : ""}`;
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

  return (
    <section className="hero-card">
      <div className="hero-text">
        <div className="hero-greeting">{greeting()},</div>
        <div className="hero-name-row">
          <Avatar name={session.name} size={48} />
          <h1 className="hero-name">{session.name}</h1>
        </div>
        <div className="hero-date-row">
          <span className="hero-date">
            {today.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="hero-week">Week {todayWeek}</span>
        </div>
      </div>
      {/* Always render the portrait+counters block for guardians so its arrival doesn't
       * push the hero card height. While the parent fetch is in flight, show skeletons. */}
      {session.userType === "2" && (
        <div className="hero-portrait">
          <div className="hero-portrait-top">
            <span className="hero-child-badge">
              {child ? (
                <>
                  {displayName}
                  {childClass ? ` · ${childClass}` : ""}
                </>
              ) : (
                /* Non-breaking space preserves the line-box so the badge keeps the
                 * same height as when it contains the child's name + class. */
                " "
              )}
            </span>
            {child ? (
              <Avatar name={displayName} picture={child.picture ?? null} size={60} />
            ) : (
              <Skeleton className="hero-portrait-avatar-skeleton" aria-hidden="true" />
            )}
          </div>
          <div className="hero-counters">
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
        </div>
      )}
    </section>
  );
}
