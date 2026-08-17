"use strict";

function isMediaRequestAllowed({ allowedOrigins, requestUrl, permission }) {
  if (permission !== "media" && permission !== "display-capture") return false;
  let origin;
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    return false;
  }
  return allowedOrigins.includes(origin);
}

module.exports = { isMediaRequestAllowed };
