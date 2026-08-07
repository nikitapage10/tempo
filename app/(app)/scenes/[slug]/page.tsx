"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import SceneView from "./scene-view";

export default function ScenePage() {
  const params = useParams<{ slug: string }>();
  return (
    <Suspense fallback={<div className="panel h-64 animate-pulse" />}>
      <SceneView slug={params.slug} />
    </Suspense>
  );
}
