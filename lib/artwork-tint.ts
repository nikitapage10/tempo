/** Deterministic fallback tint from track id (no deps). */
export function tintFromTrackId(trackId: string): string {
  let h = 0;
  for (let i = 0; i < trackId.length; i++) {
    h = (h * 31 + trackId.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  const sat = 35 + (h % 25);
  const light = 28 + (h % 12);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/**
 * Sample average color from an image URL via canvas.
 * Returns null on failure (CORS, decode, etc.).
 */
export async function extractArtworkTint(
  imageUrl: string
): Promise<string | null> {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (!n) return null;
    r = Math.round(r / n);
    g = Math.round(g / n);
    b = Math.round(b / n);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
