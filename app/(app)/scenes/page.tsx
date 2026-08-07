import { Suspense } from "react";
import ScenesView from "./scenes-view";

export default function ScenesPage() {
  return (
    <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
      <ScenesView />
    </Suspense>
  );
}
