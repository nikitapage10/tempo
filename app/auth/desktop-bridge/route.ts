import { NextResponse } from "next/server";
import {
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PATH,
  OAUTH_LOOPBACK_PORTS,
} from "@/lib/desktop/oauth-loopback";

function isSafeNext(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

/**
 * HTTPS landing page after Google / Microsoft OAuth on TEMPO Desktop.
 * Does NOT exchange the auth code — that must happen inside Electron so
 * session cookies land in the app.
 *
 * Hands the code to the running shell two ways:
 * 1. POST/GET http://127.0.0.1:<port>/oauth/handoff (Chrome/Edge often block tempo://)
 * 2. tempo://auth/callback as a fallback (Open TEMPO button + retries)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = isSafeNext(nextParam) ? nextParam : "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "auth");
    if (errorDescription) {
      login.searchParams.set("detail", errorDescription.slice(0, 160));
    }
    return NextResponse.redirect(login);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const tempo = new URL("tempo://auth/callback");
  tempo.searchParams.set("code", code);
  tempo.searchParams.set("next", next);
  const state = searchParams.get("state");
  if (state) tempo.searchParams.set("state", state);

  const deepLink = tempo.toString();
  const safeHref = deepLink
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

  const payload = { code, next, state: state || null };
  const loopback = {
    host: OAUTH_LOOPBACK_HOST,
    path: OAUTH_LOOPBACK_PATH,
    ports: [...OAUTH_LOOPBACK_PORTS],
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening TEMPO…</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: Inter, system-ui, sans-serif; background: #0A0A0C; color: #F2F0EB;
    }
    main {
      max-width: 22rem; padding: 1.5rem; text-align: center;
      border: 1px solid #26262E; border-radius: 16px; background: #121216;
    }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
    p { margin: 0 0 1.25rem; font-size: 0.875rem; color: #8B8B96; line-height: 1.45; }
    a {
      display: inline-flex; align-items: center; justify-content: center;
      height: 2.5rem; padding: 0 1rem; border-radius: 8px;
      background: #7FB4FF; color: #0A0A0C; text-decoration: none; font-size: 0.875rem; font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Opening TEMPO</h1>
    <p id="copy">Sign-in finished in the browser. Return to the app to continue — if it doesn’t open, use the button below.</p>
    <a id="open" href="${safeHref}">Open TEMPO</a>
  </main>
  <script>
    (function () {
      var href = ${JSON.stringify(deepLink)};
      var payload = ${JSON.stringify(payload)};
      var loopback = ${JSON.stringify(loopback)};
      var handed = false;

      function markDone() {
        if (handed) return;
        handed = true;
        var title = document.getElementById("title");
        var copy = document.getElementById("copy");
        if (title) title.textContent = "You can close this tab";
        if (copy) copy.textContent = "TEMPO should be signing you in now. Switch back to the app if it isn’t already in front.";
      }

      function qs() {
        var params = new URLSearchParams();
        params.set("code", payload.code);
        params.set("next", payload.next);
        if (payload.state) params.set("state", payload.state);
        return params.toString();
      }

      function loopbackUrl(port) {
        return "http://" + loopback.host + ":" + port + loopback.path + "?" + qs();
      }

      function pingLoopback() {
        var query = qs();
        loopback.ports.forEach(function (port) {
          try {
            var img = new Image();
            img.src = "http://" + loopback.host + ":" + port + loopback.path + "?" + query;
          } catch (e) {}
          fetch(loopbackUrl(port), {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(function (res) {
            if (res && res.ok) markDone();
          }).catch(function () {});
        });
      }

      function goTempo() {
        try { window.location.href = href; } catch (e) {}
      }

      pingLoopback();
      setTimeout(pingLoopback, 400);
      setTimeout(goTempo, 700);
      setTimeout(goTempo, 1600);
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
