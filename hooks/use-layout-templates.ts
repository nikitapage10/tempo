"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteLayoutTemplate,
  listLayoutTemplates,
  saveLayoutTemplate,
  updateLayoutTemplate,
} from "@/lib/api/layout-templates";

const KEY = ["layout-templates"] as const;

export function useLayoutTemplates() {
  return useQuery({ queryKey: KEY, queryFn: listLayoutTemplates });
}

export function useLayoutTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: saveLayoutTemplate,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: {
      id: string;
      layout: { left: string[][]; right: string[][]; leftPct?: number };
    }) => updateLayoutTemplate(input.id, input.layout),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteLayoutTemplate,
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
