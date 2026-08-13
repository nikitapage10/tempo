/**
 * Loopback HTTP server for desktop OAuth return.
 *
 * Bound to 127.0.0.1 only. The system-browser landing page on mytempo.dev
 * posts the one-time auth code here so Chrome/Edge don't have to honor
 * tempo://. Keep ports/path in lockstep with lib/desktop/oauth-loopback.ts.
 */

const http = require("http");

const OAUTH_LOOPBACK_HOST = "127.0.0.1";
const OAUTH_LOOPBACK_PATH = "/oauth/handoff";
const OAUTH_LOOPBACK_PORTS = [47821, 47822, 47823, 47824, 47825];
const MAX_BODY_BYTES = 8 * 1024;

function corsHeaders(origin, allowedOrigins) {
  const allow =
    typeof origin === "string" && allowedOrigins.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    Connection: "close",
    Vary: "Origin",
  };
}

function pathMatches(pathname) {
  const trimmed = (pathname || "").replace(/\/+$/, "") || "/";
  return trimmed === OAUTH_LOOPBACK_PATH;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function parseHandoff(url, body) {
  let code = url.searchParams.get("code");
  let next = url.searchParams.get("next") || "/";
  let state = url.searchParams.get("state");
  if (body && typeof body === "object") {
    if (typeof body.code === "string") code = body.code;
    if (typeof body.next === "string") next = body.next;
    if (typeof body.state === "string") state = body.state;
  }
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return { code: trimmed, next: safeNext, state: state || null };
}

/**
 * @param {{ allowedOrigins: string[], onHandoff: (payload: { code: string, next: string, state: string | null }) => boolean }} opts
 * @returns {http.Server}
 */
function createOauthLoopbackServer({ allowedOrigins, onHandoff }) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    const headers = corsHeaders(origin, allowedOrigins);

    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    let url;
    try {
      url = new URL(req.url || "/", `http://${OAUTH_LOOPBACK_HOST}`);
    } catch {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    if (!pathMatches(url.pathname)) {
      res.writeHead(404, { ...headers, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    if (origin && !allowedOrigins.includes(origin)) {
      res.writeHead(403, { ...headers, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      res.writeHead(405, headers);
      res.end();
      return;
    }

    const body = req.method === "POST" ? await readJsonBody(req) : null;
    const payload = parseHandoff(url, body);
    if (!payload) {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    let ok = false;
    try {
      ok = Boolean(onHandoff(payload));
    } catch {
      ok = false;
    }
    res.writeHead(ok ? 200 : 400, {
      ...headers,
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ ok }));
  });
}

/**
 * Bind the first free port in OAUTH_LOOPBACK_PORTS on 127.0.0.1.
 * @returns {Promise<{ port: number, close: () => void } | null>}
 */
function startOauthLoopback(opts) {
  return new Promise((resolve) => {
    const tryPort = (index) => {
      if (index >= OAUTH_LOOPBACK_PORTS.length) {
        resolve(null);
        return;
      }
      const port = OAUTH_LOOPBACK_PORTS[index];
      const server = createOauthLoopbackServer(opts);
      const onError = (err) => {
        server.off("listening", onListen);
        try {
          server.close();
        } catch {
          /* ignore */
        }
        if (err && err.code === "EADDRINUSE") {
          tryPort(index + 1);
          return;
        }
        resolve(null);
      };
      const onListen = () => {
        server.off("error", onError);
        resolve({
          port,
          close: () =>
            new Promise((done) => {
              try {
                server.close(() => done());
              } catch {
                done();
              }
            }),
        });
      };
      server.once("error", onError);
      server.once("listening", onListen);
      server.listen(port, OAUTH_LOOPBACK_HOST);
    };
    tryPort(0);
  });
}

module.exports = {
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PATH,
  OAUTH_LOOPBACK_PORTS,
  createOauthLoopbackServer,
  startOauthLoopback,
  parseHandoff,
  pathMatches,
};
