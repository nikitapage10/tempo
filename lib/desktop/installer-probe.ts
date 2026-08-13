/**
 * Probe whether a public installer URL is actually downloadable.
 * Used by /api/desktop/* redirects so Download never 404s when the
 * GitHub release channel is empty.
 */
export async function publicInstallerExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    if (head.ok) return true;

    const ranged = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      cache: "no-store",
    });
    return ranged.ok || ranged.status === 206;
  } catch {
    return false;
  }
}
