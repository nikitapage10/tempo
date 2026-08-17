"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CreateSessionDialog } from "@/components/sessions/create-session-dialog";
import { SessionCard } from "@/components/sessions/session-card";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Chip } from "@/components/ui/chip";
import { FilterGroup, FilterSep, FilterToolbar } from "@/components/ui/filter-row";
import { PageHeader } from "@/components/ui/page-header";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSessionRooms, useSessionRoomsSchemaReady } from "@/hooks/use-session-rooms";

type Filter = "active" | "archived" | "mine";

export default function SessionsPage() {
  const { activeArtist } = useActiveArtist();
  const user = useCurrentUser();
  const schema = useSessionRoomsSchemaReady();
  const { data: rooms = [], isLoading } = useSessionRooms(activeArtist?.id ?? null);
  const [filter, setFilter] = React.useState<Filter>("active");
  const [createOpen, setCreateOpen] = React.useState(false);

  const visible = rooms.filter((room) => {
    if (filter === "archived") return room.status === "archived";
    if (filter === "mine") {
      return room.members.some((member) => member.user_id === user?.id && member.role === "host");
    }
    return room.status === "active";
  });

  if (schema.data === false) {
    return (
      <EmptyShaderPanel
        title="Sessions is almost ready"
        copy="The database update for Sessions still needs to run. Ask the person who looks after TEMPO to run migrations 114 and 115."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Sessions"
        subtitle="Rooms where you and your people plan, talk, and work on a song together."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            New session
          </Button>
        }
      >
        <FilterToolbar>
          <FilterGroup label="Show">
            <Chip size="sm" active={filter === "active"} onClick={() => setFilter("active")}>
              Active
            </Chip>
            <Chip size="sm" active={filter === "archived"} onClick={() => setFilter("archived")}>
              Archived
            </Chip>
            <Chip size="sm" active={filter === "mine"} onClick={() => setFilter("mine")}>
              Mine
            </Chip>
          </FilterGroup>
          <FilterSep />
        </FilterToolbar>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel-quiet h-32 animate-pulse" />
          <div className="panel-quiet h-32 animate-pulse" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyShaderPanel
          title="No sessions yet"
          copy="Start a room for a song, a night, or a record that will take months. Agenda, notes, chat, and the people stay here."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              New session
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((room) => (
            <SessionCard key={room.id} room={room} />
          ))}
        </div>
      )}

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
