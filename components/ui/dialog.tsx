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

export function Dialog({
  open,
  onOpenChange,
  children,
  workspaceCentered = false,
}: DialogProps) {
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open || !portalReady) return null;

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
        "max-h-[90vh] overflow-y-auto rounded-card border border-line bg-bg-1 p-5 shadow-raise",
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
