import { redirect } from "next/navigation";

/**
 * A distinct full-document hop for Electron before the signed-in app mounts.
 * This keeps macOS from coalescing Origin's direct navigation to `/` and makes
 * the server workspace gate re-read the demo row created by the prior request.
 */
export const dynamic = "force-dynamic";

export default function OpenDemoPage() {
  redirect("/");
}
