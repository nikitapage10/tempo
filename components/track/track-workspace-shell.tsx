import type * as React from "react";

type TrackWorkspaceShellProps = {
  header: React.ReactNode;
  timeline: React.ReactNode;
  primary: React.ReactNode;
  panel: React.ReactNode;
};

/**
 * Track workspace regions (V2 §3): ambient header, stage timeline, a
 * dominant primary column (player, versions, workflow strip, sessions),
 * and a work panel that goes sticky on desktop. Mobile stacks everything
 * in document order — header → timeline → primary → panel.
 */
export function TrackWorkspaceShell({
  header,
  timeline,
  primary,
  panel,
}: TrackWorkspaceShellProps) {
  return (
    <div className="space-y-4">
      {header}
      {timeline}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">{primary}</div>
        <div>{panel}</div>
      </div>
    </div>
  );
}
