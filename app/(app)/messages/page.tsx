import { Suspense } from "react";
import MessagesView from "./messages-view";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
      <MessagesView />
    </Suspense>
  );
}
