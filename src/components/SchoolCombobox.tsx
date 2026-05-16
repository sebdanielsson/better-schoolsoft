import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SchoolOption } from "../api/schoolsoft.ts";

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
    <div className="school-combobox" ref={rootRef}>
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
      />
      <button
        type="button"
        className="school-combobox-toggle"
        aria-label={open ? "Close school list" : "Open school list"}
        tabIndex={-1}
        onMouseDown={(e) => {
          /* Use mousedown so we toggle before blur closes the popup. */
          e.preventDefault();
          setOpen((v) => !v);
          inputRef.current?.focus();
        }}
      >
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <ul className="school-combobox-list" id={listboxId} role="listbox" ref={listRef}>
          {loading && <li className="school-combobox-empty">Loading schools…</li>}
          {!loading && error && (
            <li className="school-combobox-empty school-combobox-error">{error}</li>
          )}
          {!loading && !error && filtered.length === 0 && (
            <li className="school-combobox-empty">
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
                className={`school-combobox-option ${i === activeIdx ? "is-active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
                onMouseEnter={() => {
                  setActiveIdx(i);
                }}
              >
                <div className="school-combobox-primary">{o.primaryName}</div>
                <div className="school-combobox-meta">
                  <code className="school-combobox-slug">{o.slug}</code>
                  {o.subNames.length > 0 && (
                    <span className="school-combobox-subnames">
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
