"use client";

import * as React from "react";
import Link from "next/link";
import { AtSign } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { HandleField, type HandleState } from "@/components/social/handle-field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { checkHandleAvailable } from "@/lib/api/artist-profile";
import { normalizeHandle, validateHandle } from "@/lib/social/handle";

/**
 * Change the @handle from Settings without opening the full profile editor.
 *
 * Same live availability check as join / profile edit — finding out a handle
 * is taken only after Save is how people end up stuck with a name they did
 * not mean to keep.
 */
export function HandlePanel() {
  const { toast } = useToast();
  const { mode } = useWorkspaceMode();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading, save } = useArtistProfile(activeArtist?.id ?? null);
  const [handle, setHandle] = React.useState("");
  const [handleState, setHandleState] = React.useState<HandleState>({
    value: "",
    ready: false,
  });
  const [seeded, setSeeded] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) return;
    setHandle(profile?.handle ?? "");
    setSeeded(true);
  }, [isLoading, profile?.handle, activeArtist?.id]);

  const current = profile?.handle ?? null;
  const typed = normalizeHandle(handle);
  const unchanged = Boolean(current) && typed === current;
  const canSave =
    seeded &&
    !unchanged &&
    Boolean(typed) &&
    handleState.ready &&
    !save.isPending;

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!activeArtist || !canSave) return;
    const checked = validateHandle(typed);
    if (!checked.ok) {
      toast(checked.message);
      return;
    }
    if (!(await checkHandleAvailable(checked.handle, activeArtist.id))) {
      toast(`@${checked.handle} is already taken.`);
      return;
    }
    try {
      await save.mutateAsync({
        patch: { handle: checked.handle },
        displayName: activeArtist.name,
      });
      toast(`Handle updated to @${checked.handle}.`, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update your handle.");
    }
  }

  const profileHref = mode === "work" ? "/profile" : "/artist";

  return (
    <section className="panel p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
          <AtSign className="size-4 text-ice" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight text-text-hi">
            Handle
          </p>
          <p className="mt-1 text-sm text-text-lo">
            Your unique TEMPO address and @mention. Availability is checked as
            you type — you will see whether it is free before you save.
          </p>

          {!activeArtist ? (
            <p className="mt-4 text-sm text-text-lo">
              Pick an artist first, then come back to change the handle.
            </p>
          ) : isLoading || !seeded ? (
            <div className="mt-4 h-20 animate-pulse rounded-input bg-bg-2/60" />
          ) : (
            <form onSubmit={(event) => void onSave(event)} className="mt-4 space-y-3">
              <HandleField
                id="settings-handle"
                value={handle}
                onChange={setHandle}
                onStateChange={setHandleState}
                currentArtistId={activeArtist.id}
                currentHandle={current}
                disabled={save.isPending}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={!canSave}>
                  {save.isPending ? "Saving…" : "Save handle"}
                </Button>
                <Button asChild type="button" size="sm" variant="ghost">
                  <Link href={profileHref}>
                    {mode === "work" ? "Open Profile" : "Open Artist profile"}
                  </Link>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
