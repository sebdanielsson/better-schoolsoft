import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";

export default function SettingsPill() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  /** Anchor position the menu is drawn relative to. Recomputed each time the menu opens
   *  (and on scroll/resize while open) so the menu stays glued to the button. */
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function reposition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      reposition();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={
          "flex items-center justify-center gap-1 rounded-full border-0 cursor-pointer font-[inherit] font-medium text-white transition-colors backdrop-blur-[4px] " +
          "pl-[0.4rem] pr-[0.55rem] py-[0.15rem] text-[11px] basis-[calc(50%-0.2rem)] grow-0 shrink-0 sm:gap-[0.4rem] sm:pl-[0.6rem] sm:pr-[0.7rem] sm:py-1 sm:text-xs sm:basis-auto " +
          (open ? "bg-white/30 " : "bg-white/15 hover:bg-white/30 ")
        }
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center leading-none w-[1.2rem] h-[1.2rem] text-[1.05rem] sm:w-[1.4rem] sm:h-[1.4rem] sm:text-[1.25rem]"
        >
          ⚙
        </span>
        <span className="inline-flex items-center justify-center leading-none h-[1.2rem] sm:h-[1.4rem]">
          Settings
        </span>
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            className="settings-pill-menu"
            role="menu"
            style={{ top: `${anchor.top}px`, right: `${anchor.right}px` }}
          >
            <Link
              to="/profile"
              className="settings-pill-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
              }}
            >
              <span aria-hidden="true" className="settings-pill-item-icon">
                ⚙
              </span>
              Profile settings
            </Link>
            <button
              type="button"
              className="settings-pill-item settings-pill-item--destructive"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
                void navigate("/login");
              }}
            >
              <span aria-hidden="true" className="settings-pill-item-icon">
                ↩
              </span>
              Sign out
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
