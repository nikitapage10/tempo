import type { SceneKind } from "@/lib/types";

export const SCENE_KIND_OPTIONS: { value: SceneKind; label: string }[] = [
  { value: "other", label: "Scene" },
  { value: "label", label: "Label" },
  { value: "school", label: "School" },
  { value: "crew", label: "Crew" },
  { value: "collective", label: "Collective" },
  { value: "genre", label: "Genre" },
  { value: "local", label: "Local" },
];
