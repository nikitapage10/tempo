"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useSceneEvents } from "@/hooks/use-scene-events";
import { SceneEventCard } from "@/components/scenes/scene-event-card";
import { SceneEventDialog } from "@/components/scenes/scene-event-dialog";
import { Button } from "@/components/ui/button";
import { useSceneSections } from "@/hooks/use-scene-v2";

export function SceneEvents({
  sceneId,
  myProfileId,
  isManager,
}: {
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
}) {
  const searchParams = useSearchParams();
  const { data: sections = [] } = useSceneSections(sceneId);
  const sectionId = sections.find((section) => section.slug === searchParams.get("section") && section.type === "events")?.id ?? null;
  const { data: allEvents = [], isLoading } = useSceneEvents(sceneId, myProfileId);
  const events = sectionId ? allEvents.filter((event) => event.scene_section_id === sectionId) : allEvents;
  const [creating, setCreating] = React.useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => !e.start_date || e.start_date >= today);
  const past = events.filter((e) => e.start_date && e.start_date < today);

  return (
    <div className="space-y-4">
      {isManager ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            New event
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="panel-quiet h-24 animate-pulse" />
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-text-lo">No upcoming events.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <SceneEventCard key={e.id} event={e} sceneId={sceneId} myProfileId={myProfileId} isManager={isManager} />
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <details className="pt-2">
          <summary className="cursor-pointer text-xs text-text-lo hover:text-text-hi">
            {past.length} past {past.length === 1 ? "event" : "events"}
          </summary>
          <div className="mt-3 space-y-3">
            {past.map((e) => (
              <SceneEventCard key={e.id} event={e} sceneId={sceneId} myProfileId={myProfileId} isManager={isManager} />
            ))}
          </div>
        </details>
      ) : null}

      <SceneEventDialog
        open={creating}
        onOpenChange={setCreating}
        sceneId={sceneId}
        sectionId={sectionId}
        myProfileId={myProfileId}
      />
    </div>
  );
}
