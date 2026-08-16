"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ProIdentityProfile } from "@/components/profile/pro-identity-profile";
import { MyMemberProfile } from "@/components/team/my-member-profile";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="Your professional identity—name, handle, story, roles, and how people can connect with you."
      />
      <MyMemberProfile variant="page" />
      <ProIdentityProfile />
    </div>
  );
}
