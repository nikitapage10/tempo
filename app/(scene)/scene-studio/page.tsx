"use client";

import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { SceneCard } from "@/components/scenes/scene-card";
import { useMyScenes } from "@/hooks/use-scenes";

export default function SceneStudioHome() {
  const { data: scenes = [], isLoading } = useMyScenes();
  const managed = scenes.filter((scene) => scene.my_role === "owner" || scene.my_role === "moderator");

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <div>
          <p className="label-mono">Operations</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text-hi">Scene Studio</h1>
          <p className="mt-2 max-w-xl text-sm text-text-lo">Shape the member experience, publishing rhythm, access, and visual identity across your networks.</p>
        </div>
      </div>

      {isLoading ? <div className="panel h-56 animate-pulse" /> : managed.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {managed.map((scene) => <div key={scene.id} className="space-y-2"><SceneCard scene={scene} href={`/scene-studio/${scene.slug}`} /><Link href={`/scene-studio/${scene.slug}`} className="flex items-center justify-between rounded-input border border-line px-3 py-2 text-xs text-text-lo hover:text-ice"><span className="inline-flex items-center gap-2"><BarChart3 className="size-3.5" />Open studio</span><ArrowRight className="size-3.5" /></Link></div>)}
        </div>
      ) : (
        <div className="panel p-8 text-center"><h2 className="font-display text-xl font-semibold text-text-hi">No Scenes to manage yet</h2><p className="mt-2 text-sm text-text-lo">Create a Scene from the TEMPO workspace, then return here to shape its network.</p></div>
      )}
    </div>
  );
}
