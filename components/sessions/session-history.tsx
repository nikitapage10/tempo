"use client";

import { useSessionHistory } from "@/hooks/use-session-rooms";
import { formatDuration } from "@/lib/format";

export function SessionHistory({ roomId }: { roomId: string }) {
  const { data } = useSessionHistory(roomId);
  const meets = data?.meets ?? [];
  const attendance = data?.attendance ?? [];
  const decisions = data?.decisions ?? [];

  if (meets.length === 0) {
    return <p className="text-sm text-text-lo">No hangs yet. Start one when people gather.</p>;
  }

  return (
    <ul className="space-y-3">
      {meets.map((meet) => {
        const people = attendance.filter((row) => row.session_meet_id === meet.id);
        const logged = decisions.filter((row) => row.session_meet_id === meet.id);
        return (
          <li key={meet.id} className="well p-3">
            <p className="text-sm text-text-hi">
              {new Date(meet.started_at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {meet.ended_at ? "" : " · open now"}
            </p>
            {meet.summary ? <p className="mt-1 text-sm text-text-lo">{meet.summary}</p> : null}
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
