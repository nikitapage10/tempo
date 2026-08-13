"use client";

import { PageHeader } from "@/components/ui/page-header";
import { MyMemberProfile } from "@/components/team/my-member-profile";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="Your name and photo — how artists you work with, and people on Social, see you."
      />
      <MyMemberProfile variant="page" />
    </div>
  );
}
