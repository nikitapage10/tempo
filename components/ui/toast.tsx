"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  message: string;
  tone?: "error" | "ok" | "info";
  action?: ToastAction;
};

type ToastContextValue = {
  toast: (message: string, tone?: Toast["tone"], action?: ToastAction) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message: string) => {
        console.warn("[toast]", message);
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback(
    (message: string, tone: Toast["tone"] = "error", action?: ToastAction) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, tone, action }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, action ? 8000 : 5500);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 right-4 z-[200] flex w-[min(100%-2rem,22rem)] flex-col gap-2 md:bottom-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-card border px-3 py-2.5 text-sm shadow-raise",
              t.tone === "ok" && "border-ok/40 bg-bg-1 text-ok",
              t.tone === "info" && "border-ice/40 bg-bg-1 text-text-hi",
              (!t.tone || t.tone === "error") &&
                "border-warn/40 bg-bg-1 text-warn"
            )}
            role="status"
          >
            <p className="min-w-0 flex-1">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="shrink-0 font-mono text-xs font-medium text-ice hover:text-ice/80"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="shrink-0 rounded-input p-0.5 text-text-lo hover:text-text-hi"
              aria-label="Dismiss"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
