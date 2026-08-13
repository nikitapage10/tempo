"use client";

import { useParams } from "next/navigation";
import { useScene } from "@/hooks/use-scenes";
import { useScenePendingRequests } from "@/hooks/use-scene-members";

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="well rounded-input px-4 py-3">
      <p className="label-mono">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-text-hi">
        {value}
      </p>
    </div>
  );
}

export default function SceneManageOverviewPage() {
  const params = useParams<{ slug: string }>();
  const { data: scene } = useScene(params.slug);
  const { data: pending = [] } = useScenePendingRequests(scene?.id ?? null, true);

  if (!scene) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Members" value={scene.member_count} />
        <StatTile label="Posts" value={scene.post_count} />
        <StatTile label="Pending requests" value={pending.length} />
        <StatTile
          label="Door"
          value={
            scene.join_policy === "open"
              ? "Open"
              : scene.join_policy === "request"
                ? "Ask to join"
                : "Invite only"
          }
        />
      </div>

      {pending.length > 0 ? (
        <div className="panel-quiet p-4 text-sm text-text-lo">
          {pending.length} {pending.length === 1 ? "person is" : "people are"} waiting on
          approval — handle it from{" "}
          <a href={`/scenes/${scene.slug}/manage/members`} className="text-ice hover:underline">
            Members
          </a>
          .
        </div>
      ) : null}
    </div>
  );
}
