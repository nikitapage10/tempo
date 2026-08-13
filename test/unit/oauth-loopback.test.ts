import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PATH,
  OAUTH_LOOPBACK_PORTS,
} from "@/lib/desktop/oauth-loopback";

const require = createRequire(import.meta.url);
const loopback = require(resolve("electron/oauth-loopback.js")) as {
  OAUTH_LOOPBACK_HOST: string;
  OAUTH_LOOPBACK_PATH: string;
  OAUTH_LOOPBACK_PORTS: number[];
  startOauthLoopback: (opts: {
    allowedOrigins: string[];
    onHandoff: (payload: {
      code: string;
      next: string;
      state: string | null;
    }) => boolean;
  }) => Promise<{ port: number; close: () => void } | null>;
};

const ORIGIN = "https://mytempo.dev";

describe("desktop OAuth loopback handoff", () => {
  let handle: { port: number; close: () => void } | null = null;

  afterEach(async () => {
    await handle?.close();
    handle = null;
  });

  it("keeps web and native loopback constants in lockstep", () => {
    expect(loopback.OAUTH_LOOPBACK_HOST).toBe(OAUTH_LOOPBACK_HOST);
    expect(loopback.OAUTH_LOOPBACK_PATH).toBe(OAUTH_LOOPBACK_PATH);
    expect(loopback.OAUTH_LOOPBACK_PORTS).toEqual([...OAUTH_LOOPBACK_PORTS]);
    const pkg = readFileSync(resolve("electron/package.json"), "utf8");
    expect(pkg).toContain("oauth-loopback.js");
  });

  it("accepts a CORS POST from the TEMPO origin and rejects others", async () => {
    const received: { code: string; next: string }[] = [];
    handle = await loopback.startOauthLoopback({
      allowedOrigins: [ORIGIN],
      onHandoff: (payload) => {
        received.push({ code: payload.code, next: payload.next });
        return true;
      },
    });
    expect(handle).not.toBeNull();
    const url = `http://${OAUTH_LOOPBACK_HOST}:${handle!.port}${OAUTH_LOOPBACK_PATH}`;

    const ok = await fetch(url, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "abc123", next: "/import" }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(received).toEqual([{ code: "abc123", next: "/import" }]);

    const blocked = await fetch(url, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "nope", next: "/" }),
    });
    expect(blocked.status).toBe(403);
    expect(received).toHaveLength(1);
  });

  it("accepts a GET ping used when fetch CORS is blocked", async () => {
    const received: string[] = [];
    handle = await loopback.startOauthLoopback({
      allowedOrigins: [ORIGIN],
      onHandoff: (payload) => {
        received.push(payload.code);
        return true;
      },
    });
    const url = `http://${OAUTH_LOOPBACK_HOST}:${handle!.port}${OAUTH_LOOPBACK_PATH}?code=from-img&next=%2F`;
    const res = await fetch(url, { method: "GET", headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(received).toEqual(["from-img"]);
  });
});
