"use strict";

function isMediaRequestAllowed({ allowedOrigins, requestUrl, permission, mediaTypes = [], mediaType }) {
  if (permission !== "media") return false;
  let origin;
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    return false;
  }
  if (!allowedOrigins.includes(origin)) return false;
  const types = Array.isArray(mediaTypes) ? mediaTypes : [];
  const videoRequested = types.includes("video") || mediaType === "video";
  const audioRequested = types.length === 0 || types.includes("audio") || mediaType === "audio";
  return audioRequested && !videoRequested;
}

module.exports = { isMediaRequestAllowed };
