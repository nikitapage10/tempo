"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMemberOnboarding,
  updateMemberOnboarding,
  type MemberOnboardingPatch,
} from "@/lib/api/member-onboarding";

const QUERY_KEY = ["member-onboarding"] as const;

export function useMemberOnboarding() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMemberOnboarding,
    staleTime: 30_000,
  });
  const update = useMutation({
    mutationFn: (patch: MemberOnboardingPatch) => updateMemberOnboarding(patch),
    onSuccess: (state) => client.setQueryData(QUERY_KEY, state),
  });
  return { ...query, update };
}
