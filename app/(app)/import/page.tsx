"use client";

import { useRouter } from "next/navigation";
import { ImportExperience } from "@/components/import/import-experience";

/**
 * /import — Bring your music in, as a standalone page.
 *
 * The flow itself lives in ImportExperience so the same thing can run as a
 * chapter inside ORIGIN. This wrapper only decides where finishing leads.
 */
export default function ImportPage() {
  const router = useRouter();

  return (
    <ImportExperience
      onComplete={() => router.push("/")}
      onDiscard={() => router.push("/")}
    />
  );
}
