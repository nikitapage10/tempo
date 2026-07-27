import type * as React from "react";

type TrackWorkspaceShellProps = {
  header: React.ReactNode;
  timeline: React.ReactNode;
  /** Toolbar row (preset picker, edit-layout toggle). */
  toolbar?: React.ReactNode;
  /** The modular two-column body — see `ModularWorkspace`. */
  content: React.ReactNode;
};

/**
 * Track workspace regions (V2 §3). Identity header and stage timeline are
 * fixed — they're how you know which track you're on. Everything below is
 * modular and arranged by the musician (`ModularWorkspace`).
 */
export function TrackWorkspaceShell({
  header,
  timeline,
  toolbar,
  content,
}: TrackWorkspaceShellProps) {
  return (
    <div className="space-y-4">
      {header}
      {timeline}
      {toolbar}
      {content}
    </div>
  );
}
