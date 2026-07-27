/**
 * Client-side lossless → mp3 conversion (ffmpeg.wasm).
 * Prefers same-origin /ffmpeg UMD assets (postinstall copy), then jsDelivr.
 */

const LOSSLESS_EXT = [".wav", ".aiff", ".aif"] as const;

export function needsMp3Conversion(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (LOSSLESS_EXT.some((ext) => lower.endsWith(ext))) return true;
  const t = file.type.toLowerCase();
  return (
    t === "audio/wav" ||
    t === "audio/x-wav" ||
    t === "audio/wave" ||
    t === "audio/aiff" ||
    t === "audio/x-aiff"
  );
}

export type ConvertProgress = (percent: number) => void;

async function loadFfmpeg(ffmpeg: {
  load: (config: {
    coreURL: string;
    wasmURL: string;
  }) => Promise<unknown>;
}) {
  const { toBlobURL } = await import("@ffmpeg/util");

  const tryLoad = async (base: string) => {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
  };

  // 1) Local UMD files served from /public/ffmpeg
  try {
    await tryLoad(`${window.location.origin}/ffmpeg`);
    return;
  } catch (err) {
    console.warn("[tempo] local ffmpeg load failed, trying CDN", err);
  }

  // 2) jsDelivr UMD (works when public assets missing)
  await tryLoad("https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd");
}

/**
 * Convert wav/aiff to a 320 kbps mp3 File. Throws with actionable copy on failure.
 */
export async function convertLosslessToMp3(
  file: File,
  onProgress?: ConvertProgress
): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("Conversion only runs in the browser.");
  }

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.max(0, Math.min(99, Math.round((progress || 0) * 100)));
      onProgress(pct);
    });
  }

  try {
    await loadFfmpeg(ffmpeg);
  } catch (err) {
    console.error("[tempo] ffmpeg load failed", err);
    throw new Error(
      "Couldn’t load the audio converter — refresh the page and try again. Or export an mp3 from your DAW and upload that."
    );
  }

  const lower = file.name.toLowerCase();
  const inExt =
    LOSSLESS_EXT.find((ext) => lower.endsWith(ext))?.replace(".", "") || "wav";
  const inputName = `input.${inExt}`;
  const outputName = "output.mp3";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const code = await ffmpeg.exec([
      "-i",
      inputName,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "320k",
      outputName,
    ]);
    if (code !== 0) {
      throw new Error(`ffmpeg exited with code ${code}`);
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);

    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "bounce";
    const out = new File([copy], `${baseName}.mp3`, {
      type: "audio/mpeg",
      lastModified: Date.now(),
    });

    onProgress?.(100);
    return out;
  } catch (err) {
    console.error("[tempo] ffmpeg convert failed", err);
    if (err instanceof Error && err.message.includes("Couldn’t load")) {
      throw err;
    }
    throw new Error(
      "Couldn’t convert that bounce to mp3 — try exporting mp3 from your DAW, or use a smaller wav."
    );
  } finally {
    try {
      ffmpeg.terminate();
    } catch {
      /* ignore */
    }
  }
}
