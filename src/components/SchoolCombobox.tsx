import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SchoolOption } from "../api/schoolsoft.ts";
import { cn } from "../lib/utils.ts";

interface Props {
  id?: string;
  value: string;
  onChange: (slug: string) => void;
  options: SchoolOption[];
  loading?: boolean;
  error?: string | null;
  placeholder?: string;
  required?: boolean;
}

export default function SchoolCombobox({
  id,
  value,
  onChange,
  options,
  loading = false,
  error = null,
  placeholder,
  required = false,
}: Props) {
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      if (o.slug.toLowerCase().includes(q)) return true;
      if (o.primaryName.toLowerCase().includes(q)) return true;
      return o.subNames.some((s) => s.toLowerCase().includes(q));
    });
  }, [value, options]);

  useEffect(() => {
    setActiveIdx(0);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  function commit(option: SchoolOption) {
    onChange(option.slug);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && filtered.length > 0) {
        const choice = filtered[activeIdx];
        if (choice) {
          e.preventDefault();
          commit(choice);
        }
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[activeIdx] ? `${listboxId}-opt-${activeIdx}` : undefined
        }
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full pl-[0.9rem] pr-[2.2rem] py-[0.7rem] border border-slate-200 rounded-lg text-base bg-white font-[inherit] transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
      />
      <button
        type="button"
        aria-label={open ? "Close school list" : "Open school list"}
        tabIndex={-1}
        onMouseDown={(e) => {
          /* Use mousedown so we toggle before blur closes the popup. */
          e.preventDefault();
          setOpen((v) => !v);
          inputRef.current?.focus();
        }}
        className="absolute top-1/2 right-[0.55rem] -translate-y-1/2 inline-flex items-center justify-center size-6 border-0 bg-transparent text-slate-500 cursor-pointer p-0 rounded-md hover:text-slate-900 hover:bg-slate-50"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <ul
          className="absolute top-[calc(100%+4px)] left-0 right-0 max-h-[260px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg list-none m-0 p-1 z-50"
          id={listboxId}
          role="listbox"
          ref={listRef}
        >
          {loading && (
            <li className="px-[0.7rem] py-[0.7rem] text-slate-500 text-sm">Loading schools…</li>
          )}
          {!loading && error && (
            <li className="px-[0.7rem] py-[0.7rem] text-red-500 text-sm">{error}</li>
          )}
          {!loading && !error && filtered.length === 0 && (
            <li className="px-[0.7rem] py-[0.7rem] text-slate-500 text-sm">
              No schools match — you can still submit a custom slug.
            </li>
          )}
          {!loading &&
            !error &&
            filtered.map((o, i) => (
              <li
                key={o.slug}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                data-idx={i}
                className={cn(
                  "px-[0.7rem] py-[0.55rem] rounded-md cursor-pointer flex flex-col gap-[0.15rem]",
                  i === activeIdx ? "bg-blue-50" : "hover:bg-blue-50",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
                onMouseEnter={() => {
                  setActiveIdx(i);
                }}
              >
                <div className="text-[0.92rem] font-medium text-slate-900 leading-[1.25]">
                  {o.primaryName}
                </div>
                <div className="flex items-center flex-wrap text-[0.78rem] text-slate-500 leading-[1.3]">
                  <code className="bg-slate-50 rounded px-[0.35rem] py-[0.05rem] text-[0.74rem] text-slate-900 font-mono">
                    {o.slug}
                  </code>
                  {o.subNames.length > 0 && (
                    <span className="ml-[0.1rem]">
                      {" · "}
                      {o.subNames.length <= 3
                        ? o.subNames.join(", ")
                        : `${o.subNames.slice(0, 3).join(", ")} +${o.subNames.length - 3} more`}
                    </span>
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
