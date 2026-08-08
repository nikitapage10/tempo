"use client";

import { Check } from "lucide-react";
import { useSceneMemberMutations } from "@/hooks/use-scene-members";
import type { Scene, SceneMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SceneWelcomeChecklist({
  scene,
  myMember,
  myProfileId,
}: {
  scene: Scene;
  myMember: SceneMember | undefined;
  myProfileId: string | null;
}) {
  const { updateMine } = useSceneMemberMutations(scene.id);
  const done = new Set(myMember?.welcome_steps_done ?? []);
  const remaining = scene.welcome_checklist.filter((s) => !done.has(s.id));

  if (!myProfileId || scene.welcome_checklist.length === 0 || remaining.length === 0) {
    return null;
  }

  function toggle(stepId: string) {
    if (!myProfileId) return;
    const next = Array.from(done);
    next.push(stepId);
    updateMine.mutate({ profileId: myProfileId, patch: { welcome_steps_done: next } });
  }

  return (
    <div className="well space-y-2 rounded-input p-4">
      <p className="label-mono">Welcome to {scene.name}</p>
      <ul className="space-y-1.5">
        {remaining.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => toggle(step.id)}
              disabled={updateMine.isPending}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-input px-2.5 py-2 text-left text-sm text-text-hi transition-colors hover:bg-bg-2"
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line">
                <Check className="size-2.5 opacity-0" />
              </span>
              {step.href ? (
                <a
                  href={step.href}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                >
                  {step.label}
                </a>
              ) : (
                step.label
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
