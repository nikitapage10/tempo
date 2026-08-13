import { NextResponse } from "next/server";

function isSafeNext(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

/**
 * HTTPS landing page after Google / Microsoft OAuth on TEMPO Desktop.
 * Does NOT exchange the auth code — that must happen inside Electron so
 * session cookies land in the app. Forwards the code via tempo://auth/callback.
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening TEMPO…</title>
  <meta http-equiv="refresh" content="0;url=${safeHref}" />
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
    <h1>Opening TEMPO</h1>
    <p>Sign-in finished in the browser. Return to the app to continue — if it doesn’t open, use the button below.</p>
    <a id="open" href="${safeHref}">Open TEMPO</a>
  </main>
  <script>
    (function () {
      var href = ${JSON.stringify(deepLink)};
      function go() {
        try { window.location.href = href; } catch (e) {}
      }
      go();
      setTimeout(go, 350);
      setTimeout(go, 1200);
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
