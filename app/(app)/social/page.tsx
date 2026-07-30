"use client";

import { EmptyShaderPanel } from "@/components/shader-empty";

/**
 * Your network — collaborators, vocalists, guest reviewers, and other
 * artists on TEMPO. Follows, discovery, a feed, and the orbit constellation
 * land here in the next phase of the social layer plan.
 */
export default function SocialPage() {
  return (
    <div className="space-y-5">
      <EmptyShaderPanel
        title="Social is on its way"
        copy="Your network, follows, and a feed of what your collaborators are up to — all landing here soon."
      />
    </div>
  );
}
