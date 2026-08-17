"use client";

import * as React from "react";
import { Lock, Users } from "lucide-react";
import { HandleField, type HandleState } from "@/components/social/handle-field";
import { suggestHandle } from "@/lib/social/handle";
import { cn } from "@/lib/utils";

/**
 * The network question, asked during onboarding instead of only in Social.
 *
 * Whether other people can see you is a decision about the whole product, and
 * finding it for the first time weeks later, buried in a tab, meant most
 * people never made it deliberately at all. It belongs beside the other
 * choices about how the workspace looks and who it is for.
 *
 * Private is the default and stays a real answer, not a delay: everything in
 * TEMPO works alone, and joining later from Social costs nothing. Choosing to
 * join asks for a handle immediately, because that is the one thing the
 * network cannot fill in on someone's behalf.
 */

export type NetworkChoice = "private" | "join";

export function NetworkChoicePanel({
  choice,
  onChoiceChange,
  handle,
  onHandleChange,
  onHandleStateChange,
  artistId,
  artistName,
  disabled,
}: {
  choice: NetworkChoice;
  onChoiceChange: (choice: NetworkChoice) => void;
  handle: string;
  onHandleChange: (handle: string) => void;
  onHandleStateChange: (state: HandleState) => void;
  artistId?: string;
  artistName?: string | null;
  disabled?: boolean;
}) {
  // Fill the field the first time they open it, and never again: re-suggesting
  // would overwrite whatever they had typed each time they changed their mind.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (choice !== "join" || seeded.current) return;
    seeded.current = true;
    if (!handle) onHandleChange(suggestHandle(artistName));
  }, [choice, handle, artistName, onHandleChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-lo">
          Other people
        </span>
        <p className="text-xs leading-snug text-text-lo/80">
          Stay private, or join so other members can find you. Work stays
          private either way.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <NetworkOption
          selected={choice === "private"}
          disabled={disabled}
          onSelect={() => onChoiceChange("private")}
          icon={<Lock className="size-3.5" />}
          title="Keep it private"
          body="Nobody sees this workspace. You can join later from Social."
        />
        <NetworkOption
          selected={choice === "join"}
          disabled={disabled}
          onSelect={() => onChoiceChange("join")}
          icon={<Users className="size-3.5" />}
          title="Join the network"
          body="Members can find your profile and follow you."
        />
      </div>

      {choice === "join" ? (
        <div className="rounded-[10px] border border-ice/25 bg-ice/[0.04] px-3 py-3">
          <HandleField
            id="origin-network-handle"
            value={handle}
            onChange={onHandleChange}
            onStateChange={onHandleStateChange}
            currentArtistId={artistId}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

function NetworkOption({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  body,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
        selected
          ? "border-ice/55 bg-ice/[0.07]"
          : "border-line/50 bg-bg-0/20 hover:border-text-lo/60",
        disabled && "opacity-60"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-text-hi">
        {icon}
        {title}
      </span>
      <span className="text-xs leading-relaxed text-text-lo/85">{body}</span>
    </button>
  );
}
