"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AvSettingsDialog } from "@/components/sessions/av-settings-dialog";
import { CallConsole } from "@/components/sessions/call-console";
import { CallWarmupPanel, hasSeenCallWarmup } from "@/components/sessions/call-warmup-panel";
import { SessionAgenda } from "@/components/sessions/session-agenda";
import { useCall } from "@/components/calls/call-provider";
import { SessionChatPanel } from "@/components/sessions/session-chat-panel";
import { SessionDecisions } from "@/components/sessions/session-decisions";
import { SessionDeck } from "@/components/sessions/session-deck";
import { SessionHistory } from "@/components/sessions/session-history";
import { SessionHeader } from "@/components/sessions/session-header";
import { SessionNotes } from "@/components/sessions/session-notes";
import { SessionRack, type SessionRackTab } from "@/components/sessions/session-rack";
import { SessionRecapDialog } from "@/components/sessions/session-recap-dialog";
import { SessionPins } from "@/components/sessions/session-pins";
import { SessionStage } from "@/components/sessions/session-stage";
import { SessionTasks } from "@/components/sessions/session-tasks";
import { ShareLinkDialog } from "@/components/sessions/share-link-dialog";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMicLevel } from "@/hooks/use-mic-level";
import { useSessionDevices } from "@/hooks/use-session-devices";
import { useSessionRoom, useSessionRoomMutations } from "@/hooks/use-session-rooms";
import { useTrack, useTracks } from "@/hooks/use-tracks";
import { useVersions } from "@/hooks/use-versions";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { isDesktopApp } from "@/lib/desktop/bridge";

function useLoudestSpeakerLevel(room: ReturnType<typeof useCall>["room"], enabled: boolean) {
  const [level, setLevel] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }
    const read = () => {
      const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
      const next = Math.max(0, ...participants.map((participant) => participant.audioLevel ?? 0));
      setLevel((current) => Math.abs(current - next) < 0.03 ? current : next);
    };
    read();
    const timer = window.setInterval(read, 240);
    return () => window.clearInterval(timer);
  }, [enabled, room]);
  return level;
}

export function SessionRoomShell({ roomId }: { roomId: string }) {
  const { toast } = useToast();
  const user = useCurrentUser();
  const { areas, activeArtist } = useWorkspaceMode();
  const { data: room, isLoading } = useSessionRoom(roomId);
  const focusedTrack = useTrack(room?.track_id ?? null);
  const focusedVersions = useVersions(room?.track_id ?? null);
  const focusTracks = useTracks(room?.space_id ?? null);
  const mutations = useSessionRoomMutations(activeArtist?.id ?? room?.artist_id ?? null, roomId);
  const call = useCall();
  const loudestLevel = useLoudestSpeakerLevel(call.room, call.onCall);
  const activateCall = call.activate;
  const devices = useSessionDevices(call.room);
  const micMediaTrack =
    (call.micTrack as { mediaStreamTrack?: MediaStreamTrack } | null)?.mediaStreamTrack ?? null;
  const micLevel = useMicLevel(micMediaTrack, call.onCall && call.micEnabled);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);
  const [notesActive, setNotesActive] = React.useState(false);
  const [relay, setRelay] = React.useState(false);
  const [warmupOpen, setWarmupOpen] = React.useState(false);
  const pingAttendance = mutations.pingAttendance.mutateAsync;
  const me = room?.members.find((member) => member.user_id === user?.id) ?? null;
  const isHost = me?.role === "host";
  const desktop = isDesktopApp();

  React.useEffect(() => {
    if (!room) return;
    activateCall({
      scope: "session",
      id: room.id,
      title: room.title,
      href: `/sessions/${room.id}`,
    });
  }, [activateCall, room]);

  React.useEffect(() => {
    if (room?.open_meet_id && user?.id) {
      void pingAttendance({
        meetId: room.open_meet_id,
        displayName: me?.display_name,
      });
    }
  }, [me?.display_name, pingAttendance, room?.open_meet_id, user?.id]);

  React.useEffect(() => {
    setNotesActive(Boolean(room?.open_meet_notes_enabled));
  }, [room?.open_meet_id, room?.open_meet_notes_enabled]);

  React.useEffect(() => {
    if (call.callPacket?.packet.kind === "notes") setNotesActive(call.callPacket.packet.active);
  }, [call.callPacket]);

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
  const currentVersion = focusedVersions.data?.find((version) => version.is_current) ?? null;
  const currentRoomId = room.id;
  const currentInstanceId = room.open_meet_id;

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

  async function changeNoteTaking(enabled: boolean) {
    if (!currentInstanceId) return;
    try {
      const response = await fetch(`/api/sessions/${currentRoomId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: currentInstanceId, enabled }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Couldn’t change note taking.");
      setNotesActive(enabled);
      void call.publishCallPacket({
        kind: "notes",
        active: enabled,
        byIdentity: call.room.localParticipant.identity,
      });
      call.publishChat();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t change note taking.");
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

  const panels: Record<SessionRackTab, React.ReactNode> = {
    agenda: <SessionAgenda roomId={room.id} artistId={room.artist_id} openMeetId={room.open_meet_id} />,
    notes: <SessionNotes roomId={room.id} artistId={room.artist_id} notes={room.notes} />,
    tasks: <SessionTasks roomId={room.id} artistId={room.artist_id} spaceId={room.space_id} members={room.members} assignees={assignees} />,
    pinned: <SessionPins roomId={room.id} artistId={room.artist_id} spaceId={room.space_id} areas={areas} />,
    decisions: <SessionDecisions roomId={room.id} artistId={room.artist_id} openMeetId={room.open_meet_id} />,
    history: <SessionHistory roomId={room.id} />,
    chat: <div className="h-[min(32rem,70dvh)] lg:hidden">{chat}</div>,
  };
  const rack = <SessionRack panels={panels} counts={{ agenda: room.open_agenda_count, tasks: room.task_count }} className="min-h-0 flex-1" />;

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <SessionHeader
        room={room}
        focusedTrack={focusedTrack.data ?? null}
        currentVersionNo={currentVersion?.version_no ?? null}
        tracks={focusTracks.data ?? []}
        live={live}
        notesActive={notesActive}
        loudestLevel={loudestLevel}
        inRoom={call.inRoom}
        onCall={call.onCallRoster}
        isHost={isHost}
        onShare={() => setShareOpen(true)}
        onToggleNotes={() => void changeNoteTaking(!notesActive)}
        onEnd={() => setEndOpen(true)}
        onTrackChange={(trackId) => void mutations.update.mutateAsync({ track_id: trackId })}
        onStart={() =>
          void mutations.startInstance
            .mutateAsync()
            .then(async (instanceId) => {
              await fetch(`/api/sessions/${room.id}/instance-notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instanceId }),
              }).catch(() => null);
              call.publishChat();
            })
            .catch((error) => toast(error instanceof Error ? error.message : "Couldn’t start the session."))
        }
      />

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
            <section className="panel prism-edge relative flex min-h-[20rem] flex-1 flex-col overflow-hidden">
              <div className="min-h-[12rem] max-h-[40dvh] flex-1 p-3 pb-20 lg:max-h-none">
                <SessionStage
                  room={call.room}
                  onCall={call.onCallRoster}
                  members={room.members}
                  live={live}
                />
              </div>
              <SessionDeck
                roomId={room.id}
                trackId={room.track_id}
                localIdentity={call.room.localParticipant.identity || null}
                callPacket={call.callPacket}
                publish={call.publishCallPacket}
                embedded
              />
              <CallConsole
                roomId={room.id}
                instanceId={room.open_meet_id}
                speakerLabel={me?.display_name || "Member"}
                notesActive={notesActive}
                onQuota={() => {
                  toast("Daily note taking time is used up. The session can keep going without it.");
                  void changeNoteTaking(false);
                }}
                desktop={desktop}
                error={call.error}
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
                className="bottom-20 sm:bottom-24"
              />
            </section>
            <div className="hidden min-h-[16rem] flex-1 lg:flex">{rack}</div>
          </div>
          <aside className="panel-quiet hidden min-h-0 flex-col overflow-y-auto lg:flex">
            <p className="label-mono border-b border-line/70 px-3 py-3">Room chat</p>
            <div className="min-h-0 flex-1">{chat}</div>
          </aside>
          <div className="flex min-h-0 flex-col overflow-hidden lg:hidden">{rack}</div>
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

      <SessionRecapDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        roomId={room.id}
        instanceId={room.open_meet_id}
        notesActive={notesActive}
        pending={mutations.endInstance.isPending}
        onApply={async (recap) => {
          if (!room.open_meet_id) return;
          try {
            for (const decision of recap.decisions) {
              if (decision.trim()) await mutations.logDecision.mutateAsync(decision.trim());
            }
            for (const task of recap.tasks) {
              const assignee = room.members.find((member) => member.display_name === task.assigneeName)?.user_id ?? null;
              await mutations.addTask.mutateAsync({
                title: task.title.trim(),
                assignee,
                dueDate: task.dueDate,
                category: "other",
              });
            }
            await mutations.endInstance.mutateAsync({ meetId: room.open_meet_id, summary: recap.summary });
            setEndOpen(false);
          } catch (error) {
            toast(error instanceof Error ? error.message : "Couldn’t finish the recap.");
          }
        }}
      />
    </div>
  );
}
