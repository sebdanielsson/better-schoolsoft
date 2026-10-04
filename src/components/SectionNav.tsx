import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils.ts";

const SECTIONS: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/schedule", label: "Schedule" },
  { to: "/calendar", label: "Calendar" },
  { to: "/subjects", label: "Subjects" },
  { to: "/absence", label: "Absence" },
  { to: "/messages", label: "Messages" },
  { to: "/news", label: "News" },
  { to: "/bookings", label: "Bookings" },
  { to: "/assessments", label: "Assessments" },
  { to: "/staff", label: "Staff" },
  { to: "/school", label: "School" },
];

/** One-row section switcher under the hero. Scrolls horizontally on narrow
 *  screens instead of wrapping, so it never pushes content down. */
export default function SectionNav() {
  return (
    <nav
      aria-label="Sections"
      className="-mx-4 mb-5 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1.5">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <NavLink
              to={s.to}
              end={s.to === "/"}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center rounded-full border px-[0.85rem] py-[0.4rem] text-[0.85rem] font-medium whitespace-nowrap no-underline transition-colors",
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600",
                )
              }
            >
              {s.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
