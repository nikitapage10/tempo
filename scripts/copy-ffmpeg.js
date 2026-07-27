/**
 * Copies ffmpeg.wasm UMD assets into public/ffmpeg for same-origin loads
 * (no CDN required on localhost / production).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "public", "ffmpeg");
fs.mkdirSync(dest, { recursive: true });

const copies = [
  [
    "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js",
    "ffmpeg-core.js",
  ],
  [
    "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm",
    "ffmpeg-core.wasm",
  ],
];

for (const [fromRel, toName] of copies) {
  const from = path.join(root, fromRel);
  const to = path.join(dest, toName);
  if (!fs.existsSync(from)) {
    console.warn(`[copy-ffmpeg] missing ${fromRel} — skip`);
    continue;
  }
  fs.copyFileSync(from, to);
  console.log(`[copy-ffmpeg] ${toName}`);
}
