// Range-aware responses for tempo-local:// vault media.
// Chromium's <audio>/<video> pipeline needs real HTTP Range (206) semantics
// to seek. protocol.handle + bare net.fetch(file://) often leaves seekable
// empty, so scrub-then-play jumps back to 0 — classic Blind A/B desktop bug.

const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");

const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

/**
 * @param {string | null} rangeHeader
 * @param {number} size
 * @returns {{ start: number, end: number } | null | "unsatisfiable"}
 */
function parseByteRange(rangeHeader, size) {
  if (!rangeHeader || size <= 0) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;
  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return "unsatisfiable";
  }
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Build a Fetch Response for a vault file, honoring Range when present.
 * @param {string} absolutePath
 * @param {Request} request
 */
function createVaultMediaResponse(absolutePath, request) {
  let size;
  try {
    size = fs.statSync(absolutePath).size;
  } catch {
    return new Response("Not found in the local vault.", { status: 404 });
  }

  const contentType = contentTypeForPath(absolutePath);
  const range = parseByteRange(request.headers.get("Range"), size);

  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  if (range) {
    const { start, end } = range;
    const length = end - start + 1;
    const nodeStream = fs.createReadStream(absolutePath, { start, end });
    return new Response(Readable.toWeb(nodeStream), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(length),
      },
    });
  }

  const nodeStream = fs.createReadStream(absolutePath);
  return new Response(Readable.toWeb(nodeStream), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
    },
  });
}

module.exports = {
  contentTypeForPath,
  parseByteRange,
  createVaultMediaResponse,
};
