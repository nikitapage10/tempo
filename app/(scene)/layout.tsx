import { redirect } from "next/navigation";
import { SceneNetworkShell } from "@/components/scenes/scene-network-shell";
import { createClient } from "@/lib/supabase/server";

export default async function SceneLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <SceneNetworkShell>{children}</SceneNetworkShell>;
}
