"use client";

import { useSessionHistory } from "@/hooks/use-session-rooms";
import { useTrack } from "@/hooks/use-tracks";
import { useVersions } from "@/hooks/use-versions";
import { formatDuration } from "@/lib/format";
import type { SessionMeet } from "@/lib/types";

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function InstanceFocus({ meet }: { meet: SessionMeet }) {
  const track = useTrack(meet.track_id);
  const versions = useVersions(meet.track_id);
  if (!meet.track_id) return null;
  if (!track.data) {
    return track.isLoading ? null : <p className="mt-2 text-xs text-text-lo">Song unavailable</p>;
  }
  const version = versions.data?.find((item) => item.id === meet.version_id);
  return (
    <p className="mt-2 text-xs text-ice">
      Worked on {track.data.title}
      {version ? ` · v${version.version_no}` : ""}
    </p>
  );
}

export function SessionHistory({ roomId }: { roomId: string }) {
  const { data } = useSessionHistory(roomId);
  const meets = data?.meets ?? [];
  const attendance = data?.attendance ?? [];
  const decisions = data?.decisions ?? [];

  if (meets.length === 0) {
    return <p className="text-sm text-text-lo">No past sessions yet. Start one when people gather.</p>;
  }

  return (
    <ul className="space-y-3">
      {meets.map((meet, index) => {
        const people = attendance.filter((row) => row.session_meet_id === meet.id);
        const logged = decisions.filter((row) => row.session_meet_id === meet.id);
        const endedAt = meet.ended_at ? new Date(meet.ended_at).getTime() : Date.now();
        const startedAt = new Date(meet.started_at).getTime();
        const duration = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
        const instanceNumber = meets.length - index;
        return (
          <li key={meet.id} className="well p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-sm font-medium text-text-hi">
                {ordinal(instanceNumber)} session
              </p>
              <p className="font-data text-xs text-text-lo">
                {meet.ended_at ? formatDuration(duration) : "LIVE"}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-lo">
              {new Date(meet.started_at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <InstanceFocus meet={meet} />
            {meet.summary ? <p className="mt-2 text-sm text-text-hi">{meet.summary}</p> : null}
            <p className="mt-2 text-xs text-text-lo">
              {people.length
                ? people
                    .map((person) => {
                      const seconds = person.on_call_seconds || 0;
                      return seconds > 0
                        ? `${person.display_name} (${formatDuration(seconds)})`
                        : person.display_name;
                    })
                    .join(", ")
                : "No attendance recorded"}
            </p>
            {logged.length ? (
              <ul className="mt-2 space-y-1">
                {logged.map((decision) => (
                  <li key={decision.id} className="text-sm text-text-hi">
                    {decision.body}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
