"use client";

import { useParams } from "next/navigation";
import { useScene } from "@/hooks/use-scenes";
import { useScenePendingRequests } from "@/hooks/use-scene-members";
import { SceneManageShell } from "@/components/scenes/manage/scene-manage-shell";
import { EmptyShaderPanel } from "@/components/shader-empty";

export default function SceneManageLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const { data: scene, isLoading } = useScene(params.slug);
  const isManager = scene?.my_role === "owner" || scene?.my_role === "moderator";
  const { data: pending = [] } = useScenePendingRequests(scene?.id ?? null, isManager);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl"><div className="panel h-64 animate-pulse" /></div>;
  }

  if (!scene || !isManager) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyShaderPanel
          title="Managers only"
          copy="You need to be an owner or moderator of this scene to see its dashboard."
        />
      </div>
    );
  }

  return (
    <SceneManageShell scene={scene} requestCount={pending.length}>
      {children}
    </SceneManageShell>
  );
}
