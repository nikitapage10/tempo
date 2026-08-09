"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Bird, Sparkles } from "lucide-react";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useMyScenes, useSceneMutations } from "@/hooks/use-scenes";
import { errorMessage } from "@/lib/utils";

export default function SceneStudioHome() {
  const { toast } = useToast();
  const { data: scenes = [], isLoading } = useMyScenes();
  const { seedDemo } = useSceneMutations();
  const managed = scenes.filter((scene) => scene.my_role === "owner" || scene.my_role === "moderator");

  async function installDemo() {
    try {
      const scene = await seedDemo.mutateAsync();
      toast("The Owl's Nest is ready.", "ok");
      window.location.href = `/scene/${scene.slug}`;
    } catch (error) {
      toast(errorMessage(error, "Couldn't build the Owl's Nest demo."));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="label-mono">Operations</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text-hi">Scene Studio</h1>
          <p className="mt-2 max-w-xl text-sm text-text-lo">Shape the member experience, publishing rhythm, access, and visual identity across your networks.</p>
        </div>
        <Button onClick={() => void installDemo()} disabled={seedDemo.isPending}>
          <Bird className="size-4" />
          {seedDemo.isPending ? "Building the Nest…" : "Install Owl's Nest demo"}
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-panel border border-amber/20 bg-[radial-gradient(circle_at_10%_0%,color-mix(in_srgb,var(--amber)_14%,transparent),transparent_48%),var(--bg-1)] p-5">
        <div className="scene-hero-grain absolute inset-0 opacity-[0.035]" />
        <div className="relative flex items-start gap-4">
          <span className="rounded-input border border-amber/20 bg-amber/10 p-2.5 text-amber"><Sparkles className="size-4" /></span>
          <div><h2 className="font-display font-semibold text-text-hi">Want to see it populated first?</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-text-lo">{"The demo creates a real Owl's Nest Scene with members from available test accounts, conversation posts, live chat, an event, resources, a welcome page, showcase work, and recognition."}</p></div>
        </div>
      </div>

      {isLoading ? <div className="panel h-56 animate-pulse" /> : managed.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {managed.map((scene) => <div key={scene.id} className="space-y-2"><SceneCard scene={scene} href={`/scene-studio/${scene.slug}`} /><Link href={`/scene-studio/${scene.slug}`} className="flex items-center justify-between rounded-input border border-line px-3 py-2 text-xs text-text-lo hover:text-ice"><span className="inline-flex items-center gap-2"><BarChart3 className="size-3.5" />Open studio</span><ArrowRight className="size-3.5" /></Link></div>)}
        </div>
      ) : (
        <div className="panel p-8 text-center"><h2 className="font-display text-xl font-semibold text-text-hi">No Scenes to manage yet</h2><p className="mt-2 text-sm text-text-lo">{"Install the Owl's Nest above, or create your own Scene from the TEMPO workspace."}</p></div>
      )}
    </div>
  );
}
