"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  ensureDefaultTemplates,
} from "@/lib/api/templates";
import type { TemplateItem } from "@/lib/types";

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: ["templates"],
    queryFn: ensureDefaultTemplates,
    enabled,
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: ({
      name,
      items,
    }: {
      name: string;
      items: TemplateItem[];
    }) => createTemplate(name, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return { create };
}
