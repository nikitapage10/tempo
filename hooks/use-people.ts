"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPeople, fetchPersonAppearances, updatePerson } from "@/lib/api/people";
import type { Person } from "@/lib/types";

export function usePeople(filters?: {
  source?: string;
  role?: string;
  tag?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: ["people", filters ?? {}],
    queryFn: () => fetchPeople(filters),
    staleTime: 30_000,
  });
}

export function usePersonAppearances(personId: string | null) {
  return useQuery({
    queryKey: ["person-appearances", personId],
    queryFn: () => fetchPersonAppearances(personId!),
    enabled: !!personId,
  });
}

export function usePersonMutations() {
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: { id: string } & Partial<
      Pick<Person, "notes" | "tags" | "roles" | "is_archived" | "display_name">
    >) => updatePerson(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });
  return { patch };
}
