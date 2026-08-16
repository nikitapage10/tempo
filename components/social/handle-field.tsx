"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { checkHandleAvailable } from "@/lib/api/artist-profile";
import { HANDLE_RULE_HINT, normalizeHandle, validateHandle } from "@/lib/social/handle";
import { cn } from "@/lib/utils";

/**
 * The one field that has to be filled in before someone is on the network.
 *
 * Availability is checked while they type rather than on submit, because the
 * good handles are gone and finding that out only after pressing Join is the
 * kind of small defeat that makes people close the screen. The check is
 * debounced and its results are keyed by the exact text they were asked about,
 * so a slow answer for an earlier draft can never label the current one.
 */

export type HandleState = {
  /** Normalized, ready to send. Empty until it is both valid and free. */
  value: string;
  ready: boolean;
};

export function HandleField({
  value,
  onChange,
  onStateChange,
  currentArtistId,
  currentHandle,
  autoFocus,
  disabled,
  id = "network-handle",
}: {
  value: string;
  onChange: (next: string) => void;
  onStateChange?: (state: HandleState) => void;
  /** Lets the artist keep the handle they already hold. */
  currentArtistId?: string;
  currentHandle?: string | null;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const [status, setStatus] = React.useState<
    "idle" | "checking" | "free" | "taken" | "invalid"
  >("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const normalized = normalizeHandle(value);
  const unchanged = Boolean(currentHandle) && normalized === currentHandle;

  const notify = React.useRef(onStateChange);
  notify.current = onStateChange;

  React.useEffect(() => {
    if (!normalized) {
      setStatus("idle");
      setMessage(null);
      notify.current?.({ value: "", ready: false });
      return;
    }
    const checked = validateHandle(normalized);
    if (!checked.ok) {
      setStatus("invalid");
      setMessage(checked.message);
      notify.current?.({ value: "", ready: false });
      return;
    }
    if (unchanged) {
      setStatus("free");
      setMessage(null);
      notify.current?.({ value: checked.handle, ready: true });
      return;
    }

    setStatus("checking");
    setMessage(null);
    notify.current?.({ value: checked.handle, ready: false });

    let cancelled = false;
    const timer = setTimeout(() => {
      void checkHandleAvailable(checked.handle, currentArtistId)
        .then((available) => {
          if (cancelled) return;
          setStatus(available ? "free" : "taken");
          setMessage(available ? null : `@${checked.handle} is already taken.`);
          notify.current?.({
            value: available ? checked.handle : "",
            ready: available,
          });
        })
        .catch(() => {
          if (cancelled) return;
          // A failed lookup is not a refusal. Let them submit; the API checks
          // again and is the authority either way.
          setStatus("idle");
          setMessage(null);
          notify.current?.({ value: checked.handle, ready: true });
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, unchanged, currentArtistId]);

  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-[11px] uppercase tracking-wider text-text-lo">
        Your handle
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-lo"
        >
          @
        </span>
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="yourname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={hintId}
          aria-invalid={status === "taken" || status === "invalid"}
          className="pl-7 pr-9 lowercase"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" ? (
            <Loader2 className="size-4 animate-spin text-text-lo" aria-hidden />
          ) : status === "free" ? (
            <Check className="size-4 text-ice" aria-hidden />
          ) : status === "taken" || status === "invalid" ? (
            <X className="size-4 text-warn" aria-hidden />
          ) : null}
        </span>
      </div>
      <p
        id={hintId}
        role={message ? "alert" : undefined}
        className={cn("text-xs leading-relaxed", message ? "text-warn" : "text-text-lo/80")}
      >
        {message ??
          (status === "free" && normalized
            ? `@${normalized} is free. Your page will live at mytempo.dev/artist/${normalized}.`
            : HANDLE_RULE_HINT)}
      </p>
    </div>
  );
}
