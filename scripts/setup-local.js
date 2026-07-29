#!/usr/bin/env node
/**
 * One-time (or re-) local setup for TEMPO.
 * Cross-platform (Windows / macOS / Linux).
 * Usage: npm run setup
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const EXAMPLE = path.join(ROOT, ".env.local.example");

function say(msg = "") {
  console.log(msg);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

say("");
say("  TEMPO — local setup");
say("  ===================");
say("");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) {
  fail(
    `Node.js 18+ required (found v${process.versions.node}). Upgrade from https://nodejs.org`
  );
}

say(`Node v${process.versions.node}`);
say(`Project: ${ROOT}`);
say("");

if (!fs.existsSync(EXAMPLE)) {
  fail(`Missing .env.local.example — open the TEMPO repo root (e.g. Documents\\TEMPO).`);
}

if (!fs.existsSync(ENV_FILE)) {
  fs.copyFileSync(EXAMPLE, ENV_FILE);
  say("Created .env.local from .env.local.example");
  say("  → Open it and paste your Supabase API values (see LOCAL-DEVELOPMENT.md).");
} else {
  say("Found existing .env.local (left unchanged).");
}
say("");

say("Installing dependencies…");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const install = spawnSync(npmCmd, ["install"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (install.status !== 0) {
  fail("npm install failed.");
}
say("");

const envText = fs.readFileSync(ENV_FILE, "utf8");
function keySet(key) {
  const re = new RegExp(`^${key}=.+$`, "m");
  return re.test(envText);
}

let missing = 0;
function checkKey(key, required) {
  if (keySet(key)) {
    say(`  ✓ ${key} is set`);
    return;
  }
  if (required) {
    say(`  ✗ ${key} is missing — required to run the app`);
    missing = 1;
  } else {
    say(`  · ${key} is unset (optional until you need that feature)`);
  }
}

say("Checking .env.local…");
checkKey("NEXT_PUBLIC_SUPABASE_URL", true);
checkKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", true);
checkKey("SUPABASE_SERVICE_ROLE_KEY", false);
checkKey("INVITE_CODE", false);
checkKey("OPENAI_API_KEY", false);
say("");

if (missing) {
  say("Fill the missing required keys in .env.local, then:");
  say("  npm run dev");
  say("");
  say("Full guide: LOCAL-DEVELOPMENT.md");
  process.exit(1);
}

say("Ready. Start the local app with:");
say("  npm run dev");
say("");
say("Then open http://localhost:3000");
if (process.platform === "win32") {
  say('Windows: you can also double-click "Launch TEMPO.bat"');
} else if (process.platform === "darwin") {
  say('Mac: you can also double-click "Launch TEMPO.command"');
}
say("");
say("Guide: LOCAL-DEVELOPMENT.md");
say("");
