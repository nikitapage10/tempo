import { Suspense } from "react";
import { StandaloneSceneView } from "@/components/scenes/standalone-scene-view";

export default function StandaloneScenePage({ params }: { params: { slug: string } }) {
  return <Suspense fallback={<div className="panel h-72 animate-pulse" />}><StandaloneSceneView slug={params.slug} /></Suspense>;
}
