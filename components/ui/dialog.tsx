"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  workspaceCentered?: boolean;
};

/**
 * Modal shell. Portaled to document.body so it is not trapped inside rail /
 * sticky / isolate stacking contexts (those made Report a problem look dead).
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  workspaceCentered = false,
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-end justify-center sm:items-center",
        workspaceCentered && "md:pl-[220px]"
      )}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close dialog"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg px-4 pb-4 sm:pb-0">
        {children}
      </div>
    </div>,
    document.body
  );
}

type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
  onClose?: () => void;
};

export function DialogContent({
  children,
  className,
  title,
  description,
  onClose,
}: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className={cn(
        "glass max-h-[90vh] overflow-y-auto rounded-card p-5",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="dialog-title"
            className="font-display text-lg font-semibold tracking-tight text-text-hi"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-text-lo">{description}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
