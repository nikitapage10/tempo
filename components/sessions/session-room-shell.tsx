"use client";

import * as React from "react";
import {
  CheckSquare,
  Gavel,
  History as HistoryIcon,
  ListChecks,
  MessageCircle,
  Mic,
  NotebookPen,
  Pin,
  Radio,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvSettingsDialog } from "@/components/sessions/av-settings-dialog";
import { CallControls } from "@/components/sessions/call-controls";
import { CallWarmupPanel, hasSeenCallWarmup } from "@/components/sessions/call-warmup-panel";
import { SessionAgenda } from "@/components/sessions/session-agenda";
import { SessionAudio } from "@/components/sessions/session-audio";
import { SessionChatPanel } from "@/components/sessions/session-chat-panel";
import { SessionDecisions } from "@/components/sessions/session-decisions";
import { SessionHistory } from "@/components/sessions/session-history";
import { SessionNotes } from "@/components/sessions/session-notes";
import { OnAirPlate, SessionAvatarStack } from "@/components/sessions/session-people";
import { SessionPins } from "@/components/sessions/session-pins";
import { SessionRoster } from "@/components/sessions/session-roster";
import { SessionStage } from "@/components/sessions/session-stage";
import { SessionTasks } from "@/components/sessions/session-tasks";
import { ShareLinkDialog } from "@/components/sessions/share-link-dialog";
import { FlareLine } from "@/components/flare-line";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMicLevel } from "@/hooks/use-mic-level";
import { useSessionCall } from "@/hooks/use-session-call";
import { useSessionDevices } from "@/hooks/use-session-devices";
import { useSessionRoom, useSessionRoomMutations } from "@/hooks/use-session-rooms";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

type Tab = "agenda" | "notes" | "tasks" | "pinned" | "decisions" | "history" | "chat";

const TAB_ICON: Record<Tab, React.ComponentType<{ className?: string }>> = {
  agenda: ListChecks,
  notes: NotebookPen,
  tasks: CheckSquare,
  pinned: Pin,
  decisions: Gavel,
  history: HistoryIcon,
  chat: MessageCircle,
};

const TAB_LABEL: Record<Tab, string> = {
  agenda: "Agenda",
  notes: "Notes",
  tasks: "Tasks",
  pinned: "Pinned",
  decisions: "Decisions",
  history: "History",
  chat: "Chat",
};

function TabButton({
  id,
  count,
  selected,
  onSelect,
  className,
}: {
  id: Tab;
  count?: number;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const Icon = TAB_ICON[id];
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-xs font-medium transition-colors duration-hover",
        selected ? "bg-bg-2 text-ice shadow-e1" : "text-text-lo hover:bg-bg-2/50 hover:text-text-hi",
        className
      )}
    >
      <Icon className={cn("size-3.5", selected ? "text-ice" : "text-text-lo group-hover:text-text-hi")} />
      {TAB_LABEL[id]}
      {count ? (
        <span
          className={cn(
            "rounded-chip px-1.5 font-data text-[10px]",
            selected ? "bg-ice/15 text-ice" : "bg-bg-2/70 text-text-lo"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function elapsedLabel(startedAt: string | null): string {
  if (!startedAt) return "";
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** Counts up for as long as the hang is open. */
function HangClock({ startedAt }: { startedAt: string | null }) {
  const [label, setLabel] = React.useState(() => elapsedLabel(startedAt));

  React.useEffect(() => {
    setLabel(elapsedLabel(startedAt));
    if (!startedAt) return;
    const timer = window.setInterval(() => setLabel(elapsedLabel(startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  if (!label) return null;
  return <span className="font-data text-xs tabular-nums text-amber">{label}</span>;
}

export function SessionRoomShell({ roomId }: { roomId: string }) {
  const { toast } = useToast();
  const user = useCurrentUser();
  const { areas, activeArtist } = useWorkspaceMode();
  const { data: room, isLoading } = useSessionRoom(roomId);
  const mutations = useSessionRoomMutations(activeArtist?.id ?? room?.artist_id ?? null, roomId);
  const call = useSessionCall({ roomId, enabled: Boolean(room) });
  const devices = useSessionDevices(call.room);
  const micMediaTrack =
    (call.micTrack as { mediaStreamTrack?: MediaStreamTrack } | null)?.mediaStreamTrack ?? null;
  const micLevel = useMicLevel(micMediaTrack, call.onCall && call.micEnabled);
  const [tab, setTab] = React.useState<Tab>("agenda");
  const [shareOpen, setShareOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);
  const [hangSummary, setHangSummary] = React.useState("");
  const [relay, setRelay] = React.useState(false);
  const [warmupOpen, setWarmupOpen] = React.useState(false);
  const pingAttendance = mutations.pingAttendance.mutateAsync;
  const me = room?.members.find((member) => member.user_id === user?.id) ?? null;
  const isHost = me?.role === "host";
  const desktop = isDesktopApp();

  React.useEffect(() => {
    if (room?.open_meet_id && user?.id) {
      void pingAttendance({
        meetId: room.open_meet_id,
        displayName: me?.display_name,
      });
    }
  }, [me?.display_name, pingAttendance, room?.open_meet_id, user?.id]);

  React.useEffect(() => {
    if (!relay) return;
    try {
      window.sessionStorage.setItem("tempo:session-call-relay", "1");
    } catch {
      /* ignore */
    }
  }, [relay]);

  if (isLoading || !room) {
    return <div className="panel h-64 animate-pulse" />;
  }

  const assignees = room.members.map((member) => ({ id: member.user_id, name: member.display_name }));
  const live = Boolean(room.open_meet_id);

  async function requestJoin() {
    if (user?.id && desktop && !hasSeenCallWarmup(user.id)) {
      setWarmupOpen(true);
      return;
    }
    try {
      await call.joinCall();
      await devices.applyAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t join the call.");
    }
  }

  const chat = (
    <SessionChatPanel
      roomId={room.id}
      myProfileId={me?.profile_id ?? null}
      myUserId={user?.id ?? null}
      members={room.members}
      onPublished={call.publishChat}
      chatTick={call.chatTick}
    />
  );

  const workbench = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line/70 bg-bg-0/25 p-2">
        <TabButton id="agenda" count={room.open_agenda_count} selected={tab === "agenda"} onSelect={() => setTab("agenda")} />
        <TabButton id="notes" selected={tab === "notes"} onSelect={() => setTab("notes")} />
        <TabButton id="tasks" count={room.task_count} selected={tab === "tasks"} onSelect={() => setTab("tasks")} />
        <TabButton id="pinned" selected={tab === "pinned"} onSelect={() => setTab("pinned")} />
        <TabButton id="decisions" selected={tab === "decisions"} onSelect={() => setTab("decisions")} />
        <TabButton id="history" selected={tab === "history"} onSelect={() => setTab("history")} />
        <TabButton id="chat" selected={tab === "chat"} onSelect={() => setTab("chat")} className="lg:hidden" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "agenda" ? <SessionAgenda roomId={room.id} artistId={room.artist_id} openMeetId={room.open_meet_id} /> : null}
        {tab === "notes" ? <SessionNotes roomId={room.id} artistId={room.artist_id} notes={room.notes} /> : null}
        {tab === "tasks" ? (
          <SessionTasks
            roomId={room.id}
            artistId={room.artist_id}
            spaceId={room.space_id}
            members={room.members}
            assignees={assignees}
          />
        ) : null}
        {tab === "pinned" ? (
          <SessionPins roomId={room.id} artistId={room.artist_id} spaceId={room.space_id} areas={areas} />
        ) : null}
        {tab === "decisions" ? (
          <SessionDecisions roomId={room.id} artistId={room.artist_id} openMeetId={room.open_meet_id} />
        ) : null}
        {tab === "history" ? <SessionHistory roomId={room.id} /> : null}
        {tab === "chat" ? <div className="h-[min(32rem,70dvh)] lg:hidden">{chat}</div> : null}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <SessionAudio room={call.room} />

      <header className="panel relative shrink-0 overflow-hidden px-4 py-4">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: live ? 1 : 0,
            background:
              "radial-gradient(120% 140% at 8% 0%, color-mix(in srgb, var(--amber) 12%, transparent) 0%, transparent 62%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <OnAirPlate live={live} />
              <HangClock startedAt={live ? room.open_meet_started_at : null} />
            </div>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold tracking-[0.02em] text-text-hi sm:text-[28px]">
              {room.title}
            </h1>
            {room.purpose ? <p className="mt-1 max-w-2xl text-sm text-text-lo">{room.purpose}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isHost ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                Share link
              </Button>
            ) : null}
            {live ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setEndOpen(true)}>
                End hang
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  void mutations.startHang
                    .mutateAsync()
                    .catch((err) => toast(err instanceof Error ? err.message : "Couldn’t start a hang."))
                }
              >
                <Radio className="size-4" />
                Start a hang
              </Button>
            )}
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <SessionAvatarStack members={room.members} size={24} />
          <SessionRoster members={room.members} inRoom={call.inRoom} onCall={call.onCallRoster} />
        </div>
        <FlareLine className="mt-3 opacity-50" />
      </header>

      {warmupOpen && user?.id ? (
        <CallWarmupPanel
          userId={user.id}
          onReady={() => {
            setWarmupOpen(false);
            void requestJoin();
          }}
          onRelay={() => {
            setRelay(true);
            setWarmupOpen(false);
            void requestJoin();
          }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-1">
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <section className="panel prism-edge relative flex min-h-[20rem] flex-1 flex-col gap-3 overflow-hidden p-3">
              <div className="min-h-[14rem] flex-1">
                <SessionStage
                  room={call.room}
                  onCall={call.onCallRoster}
                  members={room.members}
                  live={live}
                />
              </div>
              <CallControls
                onCall={call.onCall}
                micEnabled={call.micEnabled}
                cameraEnabled={call.cameraEnabled}
                screenEnabled={call.screenEnabled}
                onJoin={() => void requestJoin()}
                onLeave={() => void call.leaveCall()}
                onToggleMic={() => void call.toggleMic()}
                onToggleCamera={() => void call.toggleCamera()}
                onToggleScreen={() => void call.toggleScreen()}
                onOpenSettings={() => setSettingsOpen(true)}
                micLevel={micLevel}
                audioBlocked={call.audioBlocked}
                onEnableAudio={() => void call.unlockAudio()}
                disabled={Boolean(call.error)}
                className="mt-auto shrink-0"
              />
              {call.error ? <p className="text-center text-xs text-warn">{call.error}</p> : null}
              {desktop && !call.onCall ? (
                <p className="flex items-center justify-center gap-1 text-center text-[11px] text-text-lo">
                  <Mic className="size-3" />
                  <Video className="size-3" />
                  First join may ask Windows or macOS for permission.
                </p>
              ) : null}
            </section>
            <div className="panel-quiet hidden min-h-[16rem] flex-1 flex-col overflow-hidden lg:flex">
              {workbench}
            </div>
          </div>
          <aside className="panel-quiet hidden min-h-0 flex-col overflow-y-auto lg:flex">
            <p className="label-mono border-b border-line/70 px-3 py-3">Room chat</p>
            <div className="min-h-0 flex-1">{chat}</div>
          </aside>
          <div className="panel-quiet flex min-h-0 flex-col overflow-hidden lg:hidden">{workbench}</div>
        </div>
      )}

      <ShareLinkDialog open={shareOpen} onOpenChange={setShareOpen} roomId={room.id} />
      <AvSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        devices={devices}
        room={call.room}
        liveMicTrack={call.micTrack}
        liveCamera={call.cameraEnabled}
      />

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent
          title="End the hang"
          description="The room stays. Only the live call closes."
          onClose={() => setEndOpen(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!room.open_meet_id) return;
              void mutations.endHang
                .mutateAsync({ meetId: room.open_meet_id, summary: hangSummary })
                .then(() => {
                  setHangSummary("");
                  setEndOpen(false);
                })
                .catch((err) => toast(err instanceof Error ? err.message : "Couldn’t end the hang."));
            }}
          >
            <div>
              <Label htmlFor="hang-summary">What came out of it? (optional)</Label>
              <Input
                id="hang-summary"
                value={hangSummary}
                onChange={(event) => setHangSummary(event.target.value)}
                placeholder="Locked the second verse, Dave takes the bridge."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEndOpen(false)}>
                Keep it going
              </Button>
              <Button type="submit" disabled={mutations.endHang.isPending}>
                {mutations.endHang.isPending ? "Ending…" : "End hang"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
