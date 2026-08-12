/**
 * Resolve the newest public desktop installer from tempo-desktop-releases.
 * Download buttons go through /api/desktop/* so they always track whatever
 * Desktop Release last published — without requiring a web redeploy per bump.
 */

export const DESKTOP_RELEASES_OWNER = "nikitapage10";
export const DESKTOP_RELEASES_REPO = "tempo-desktop-releases";

export type LatestDesktopAssets = {
  version: string;
  windowsUrl: string | null;
  macUrl: string | null;
};

type GithubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  assets?: GithubReleaseAsset[];
};

function assetUrl(assets: GithubReleaseAsset[] | undefined, name: string): string | null {
  const hit = assets?.find((asset) => asset.name === name);
  return typeof hit?.browser_download_url === "string" ? hit.browser_download_url : null;
}

/**
 * Ask GitHub which release is currently `latest`. Returns null when the
 * channel is empty or unreachable so callers can fall back.
 */
export async function fetchLatestDesktopAssets(): Promise<LatestDesktopAssets | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${DESKTOP_RELEASES_OWNER}/${DESKTOP_RELEASES_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "tempo-web-download",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as GithubRelease;
    const version = (body.tag_name ?? "").replace(/^v/i, "").trim();
    if (!version) return null;
    return {
      version,
      windowsUrl: assetUrl(body.assets, "TEMPO-Setup.exe"),
      macUrl: assetUrl(body.assets, "TEMPO-Mac.dmg"),
    };
  } catch {
    return null;
  }
}
