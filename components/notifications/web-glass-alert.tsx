"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type WebGlassAlertInput = {
  kind: "message" | "notification";
  title: string;
  body?: string | null;
  url?: string | null;
  ice?: string | null;
  amber?: string | null;
};

type ActiveAlert = WebGlassAlertInput & { id: string };

type Listener = (alert: WebGlassAlertInput) => void;

const listeners = new Set<Listener>();

/** Fire a desktop-style glass toast in the browser (bottom-right). */
export function showWebGlassAlert(input: WebGlassAlertInput) {
  listeners.forEach((listener) => listener(input));
}

function useHex(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value
    : fallback;
}

/**
 * In-app cousin of Electron's glass notification window. Sits above Get help
 * (same clearance as ordinary toasts) so message alerts never cover the
 * assistant launcher.
 */
export function WebGlassAlertHost() {
  const [alert, setAlert] = React.useState<ActiveAlert | null>(null);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const listener: Listener = (next) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const id = crypto.randomUUID();
      setAlert({ ...next, id });
      timerRef.current = window.setTimeout(() => {
        setAlert((cur) => (cur?.id === id ? null : cur));
      }, 8000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!alert) return null;

  const active = alert;
  const ice = useHex(active.ice, "#7FB4FF");
  const amber = useHex(active.amber, "#FFB56B");
  const label = active.kind === "message" ? "NEW MESSAGE" : "TEMPO NOTIFICATION";

  function open() {
    const url = active.url?.trim();
    setAlert(null);
    if (url) window.location.assign(url);
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-[8.5rem] right-4 z-[95]",
        "w-[min(100%-2rem,28rem)] md:bottom-[5.5rem] md:right-5"
      )}
    >
      <button
        type="button"
        onClick={open}
        className={cn(
          "pointer-events-auto relative w-full overflow-hidden rounded-[16px] border border-line text-left",
          "bg-[linear-gradient(145deg,rgb(18_18_22/0.92),rgb(10_10_12/0.88))] shadow-3 backdrop-blur-xl",
          "transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        )}
        aria-label={`${label}: ${active.title}`}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
        <span
          aria-hidden
          className="absolute bottom-3.5 left-0 top-3.5 w-0.5 rounded-full"
          style={{
            background: `linear-gradient(to bottom, transparent, ${amber}, ${ice}, transparent)`,
            boxShadow: `0 0 16px ${ice}99`,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[30%] -top-[35%] h-[140%] w-[70%] rounded-full opacity-40"
          style={{
            background: `radial-gradient(circle, ${ice}33, transparent 70%)`,
          }}
        />
        <div className="relative grid grid-cols-[3.5rem_1fr] items-center gap-4 px-5 py-4 pl-6">
          <span className="flex size-14 items-center justify-center rounded-[14px] border border-line bg-bg-2/85">
            <span className="flex h-7 items-center gap-[3px]" aria-hidden>
              {[12, 22, 30, 22, 12].map((height, index) => (
                <i
                  key={index}
                  className="block w-1 rounded-full"
                  style={{
                    height,
                    background: `linear-gradient(${ice} 0 45%, #fff 57%, ${amber})`,
                    boxShadow: `0 0 10px ${ice}73`,
                  }}
                />
              ))}
            </span>
          </span>
          <span className="min-w-0">
            <span
              className="mb-1 block text-[11px] font-bold tracking-[0.14em]"
              style={{ color: ice }}
            >
              {label}
            </span>
            <span className="block truncate text-base font-semibold leading-snug text-text-hi">
              {active.title}
            </span>
            {active.body ? (
              <span className="mt-1.5 line-clamp-2 block text-[13px] leading-snug text-text-lo">
                {active.body}
              </span>
            ) : null}
          </span>
        </div>
      </button>
    </div>
  );
}
