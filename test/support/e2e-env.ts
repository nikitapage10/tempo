import fs from "node:fs";
import path from "node:path";

/**
 * Loads .env.test.local into a plain object WITHOUT touching process.env,
 * so it can be handed explicitly to Playwright's webServer.env. Explicit
 * env passed to a spawned `next dev` takes precedence over anything Next
 * would otherwise read from .env.local, so this is what keeps the E2E dev
 * server pointed at the test project even though .env.local (production)
 * sits right next to it in the repo.
 */
export function loadTestEnvFile(): Record<string, string> {
  const file = path.resolve(__dirname, "../../.env.test.local");
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
