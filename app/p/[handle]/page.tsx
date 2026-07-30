import type { Metadata } from "next";
import { resolvePublicArtistProfile } from "@/lib/public-profile-server";
import { PublicProfileView } from "./public-profile-view";

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const profile = await resolvePublicArtistProfile(params.handle?.toLowerCase());
  if (!profile) {
    return { title: "Profile not found — TEMPO" };
  }
  return {
    title: `${profile.display_name} — TEMPO`,
    description: profile.tagline ?? profile.bio ?? `${profile.display_name} on TEMPO.`,
  };
}

export default function PublicArtistProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  return <PublicProfileView handle={params.handle} />;
}
