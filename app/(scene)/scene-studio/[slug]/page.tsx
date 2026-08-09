import { Suspense } from "react";
import { SceneStudio } from "@/components/scenes/scene-studio";

export default function SceneStudioPage({ params }: { params: { slug: string } }) { return <Suspense fallback={<div className="panel h-72 animate-pulse" />}><SceneStudio slug={params.slug} /></Suspense>; }
