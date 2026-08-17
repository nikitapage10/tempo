"use client";

import { useParams } from "next/navigation";
import { SessionRoomShell } from "@/components/sessions/session-room-shell";

export default function SessionRoomPage() {
  const params = useParams<{ id: string }>();
  return <SessionRoomShell roomId={params.id} />;
}
