"use client";

import { useRouter } from "next/navigation";
import { ImportExperience } from "@/components/import/import-experience";
import { TryDemoButton } from "@/components/demo/try-demo-button";

/**
 * /import — Bring your music in, as a standalone page.
 *
 * The flow itself lives in ImportExperience so the same thing can run as a
 * chapter inside ORIGIN. This wrapper only decides where finishing leads, and
 * offers the demo as the alternative to importing — same reason it's offered
 * inside Origin: someone can want to see the app working before they'll hand
 * their own catalog to it.
 */
export default function ImportPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <ImportExperience
        onComplete={() => router.push("/")}
        onDiscard={() => router.push("/")}
      />

      <section className="panel-quiet flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-text-hi">Want to see it full first?</p>
          <p className="mt-0.5 text-xs text-text-lo">
            Load a demo artist — a real band four weeks out from an album, with the
            songs, sessions, deadlines and loose ends already in place. It lives on
            its own artist beside yours, and removing it takes one click.
          </p>
        </div>
        <TryDemoButton variant="secondary" size="sm" />
      </section>
    </div>
  );
}
