"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { CITY_SUGGESTIONS } from "@/lib/geo";
import { cn } from "@/lib/utils";

/**
 * A plain-text location field with a city type-ahead — typing "den" offers
 * "Denver". Suggestions are cosmetic only: the field stays free text (so
 * "Denver, CO" or a place we don't recognize both still save fine), and the
 * globe on Social geocodes whatever ends up here via `resolveLocation`.
 */
export function CityInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const blurTimeout = React.useRef<ReturnType<typeof setTimeout>>();

  const matches = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const city of CITY_SUGGESTIONS) {
      const lower = city.toLowerCase();
      if (lower === q) continue; // already typed exactly — nothing to offer
      if (lower.startsWith(q)) starts.push(city);
      else if (lower.includes(q)) contains.push(city);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [value]);

  const showList = open && matches.length > 0;

  function pick(city: string) {
    onChange(city);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on a suggestion registers before we close.
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {showList ? (
        <ul className="well absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-input border border-line bg-bg-2 p-1 shadow-e2">
          {matches.map((city, i) => (
            <li key={city}>
              <button
                type="button"
                // onMouseDown fires before the input's onBlur, so the pick
                // registers before the field loses focus and closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimeout.current) clearTimeout(blurTimeout.current);
                  pick(city);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "block w-full truncate rounded-input px-2 py-1.5 text-left text-sm",
                  i === highlight ? "bg-bg-3 text-text-hi" : "text-text-lo"
                )}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
