"use client";

import { Users } from "lucide-react";
import { SignedImage } from "@/components/ui/signed-image";
import { DEMO_TEAM } from "@/lib/demo/president";
import { ROLE_LABELS } from "@/lib/team/roles";
import { initials } from "@/lib/utils";

/**
 * The sample team on the demo artist's Team page.
 *
 * Read-only on purpose. These people are not TEMPO accounts, so there is
 * nothing here to open, message, or change — the panel exists to show what the
 * page looks like once real people are on it, and to say plainly that they
 * are not real.
 */
export function DemoTeamPanel() {
  return (
    <section className="panel-quiet p-4">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 size-4 shrink-0 text-ice" />
        <div>
          <p className="label-mono">Sample team</p>
          <p className="mt-1 text-sm leading-6 text-text-lo">
            Example people around this record — none of them are real TEMPO accounts, and nothing
            here was sent to anyone. On your own artist this is where you invite a manager, an
            agent, or anyone else, and choose what each of them can see.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {DEMO_TEAM.map((member) => (
          <li key={member.ref} className="well flex items-start gap-3 px-3 py-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-input border border-line bg-bg-2">
              <SignedImage
                path={member.photo}
                alt={member.name}
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center font-display text-xs text-text-hi">
                    {initials(member.name)}
                  </div>
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm text-text-hi">{member.name}</p>
                <span className="label-mono text-text-lo">
                  {member.title}
                  {member.org ? ` · ${member.org}` : ""}
                </span>
                {member.pending ? (
                  <span className="rounded-chip border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11px] text-amber">
                    Invite sent
                  </span>
                ) : (
                  <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-text-lo">
                    {ROLE_LABELS[member.role]} access
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-6 text-text-lo">{member.holding}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
