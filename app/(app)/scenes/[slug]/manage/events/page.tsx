"use client";

import { useParams } from "next/navigation";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useScene } from "@/hooks/use-scenes";
import { SceneEvents } from "@/components/scenes/scene-events";

export default function SceneManageEventsPage() {
  const params = useParams<{ slug: string }>();
  const { activeArtist } = useActiveArtist();
  const { profile } = useArtistProfile(activeArtist?.id ?? null);
  const { data: scene } = useScene(params.slug);

  if (!scene) return null;

  return (
    <SceneEvents sceneId={scene.id} myProfileId={profile?.id ?? null} isManager />
  );
}
