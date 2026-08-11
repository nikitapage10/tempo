#!/usr/bin/env node

/**
 * One local TEMPO preview shared by every worktree and coding tool.
 *
 * The preview always uses http://localhost:3000. `ensure` reuses a healthy
 * TEMPO server instead of letting Next.js choose another port. `switch`
 * deliberately hands that one preview slot to the current worktree.
 */

const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, spawnSync, execFileSync } = require("child_process");

const PORT = 3000;
const HOST = "127.0.0.1";
const ORIGIN = `http://localhost:${PORT}`;
const SESSION_URL = `${ORIGIN}/api/dev/session`;
const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(os.tmpdir(), "tempo-dev-server");
const STATE_FILE = path.join(RUNTIME_DIR, "state.json");
const LOCK_DIR = path.join(RUNTIME_DIR, "launch.lock");
const LOG_FILE = path.join(RUNTIME_DIR, "next-dev.log");
const command = process.argv[2] || "ensure";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(pathname, timeout = 1000) {
  return new Promise((resolve) => {
    const request = http.get(
      { hostname: HOST, port: PORT, path: pathname, timeout },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
}

function portIsOpen(timeout = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function tempoStatus(checkNetwork = false) {
  const status = await requestJson(
    checkNetwork ? "/api/dev/status?network=1" : "/api/dev/status",
    checkNetwork ? 7000 : 1000
  );
  return status?.app === "tempo" ? status : null;
}

function gitValue(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function sharedCheckoutRoot() {
  const commonDir = gitValue(["rev-parse", "--git-common-dir"], "");
  if (!commonDir) return null;
  const absoluteCommonDir = path.resolve(ROOT, commonDir);
  return path.basename(absoluteCommonDir) === ".git"
    ? path.dirname(absoluteCommonDir)
    : null;
}

function loadLocalEnvironment() {
  const explicit = process.env.TEMPO_SHARED_ENV_FILE
    ? path.resolve(process.env.TEMPO_SHARED_ENV_FILE)
    : null;
  const current = path.join(ROOT, ".env.local");
  const sharedRoot = sharedCheckoutRoot();
  const shared = sharedRoot ? path.join(sharedRoot, ".env.local") : null;
  const envFile = [explicit, current, shared].find(
    (candidate) => candidate && fs.existsSync(candidate)
  );

  if (!envFile) return null;
  require("dotenv").config({ path: envFile, override: false, quiet: true });
  return envFile;
}

function describe(status) {
  const branch = status.branch || "unknown branch";
  const root = status.root || "unknown worktree";
  return `${branch}\n  ${root}`;
}

function printReady(status, reused) {
  console.log(`${reused ? "Reusing" : "Started"} the one TEMPO preview:`);
  console.log(`  App:     ${ORIGIN}`);
  console.log(
    status.localSignIn
      ? `  Sign in: ${SESSION_URL}`
      : "  Sign in: add DEV_PREVIEW_EMAIL to the primary .env.local"
  );
  console.log(`  Branch:  ${status.branch || "unknown"}`);
  console.log(`  Source:  ${status.root || ROOT}`);
  if (status.backendReachable === false) {
    console.warn("  Backend: unavailable — restart this preview with network permission");
  } else if (status.backendReachable === true) {
    console.log("  Backend: connected");
  }
}

async function acquireLock() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  try {
    fs.mkdirSync(LOCK_DIR);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const ageMs = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
      if (ageMs > 120000) {
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
        fs.mkdirSync(LOCK_DIR);
        return true;
      }
    } catch {
      // A concurrent launcher may have released it; the retry loop handles it.
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await tempoStatus();
      if (status) return false;
      await sleep(250);
    }
    return false;
  }
}

function releaseLock() {
  fs.rmSync(LOCK_DIR, { recursive: true, force: true });
}

async function waitForTempo(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await tempoStatus();
    if (status) return status;
    await sleep(500);
  }
  return null;
}

async function start() {
  const locked = await acquireLock();
  if (!locked) {
    const status = await waitForTempo(10000);
    if (status) return printReady(status, true);
    throw new Error(`Another TEMPO preview launch is still in progress. See ${LOG_FILE}`);
  }

  try {
    const existing = await tempoStatus(true);
    if (existing) {
      printReady(existing, true);
      if (existing.backendReachable === false) process.exitCode = 2;
      return;
    }
    if (await portIsOpen()) {
      throw new Error(
        `Port ${PORT} is occupied by an older or uncoordinated server. Stop that server once; TEMPO will not silently move to another port.`
      );
    }

    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextBin)) {
      throw new Error("This worktree is not installed yet. Run npm install once, then npm run dev again.");
    }

    const envFile = loadLocalEnvironment();
    const branch = gitValue(["branch", "--show-current"]);
    const logFd = fs.openSync(LOG_FILE, "a");
    fs.appendFileSync(
      LOG_FILE,
      `\n--- ${new Date().toISOString()} | ${branch} | ${ROOT} ---\n`
    );

    const child = spawn(
      process.execPath,
      [nextBin, "dev", "--hostname", HOST, "--port", String(PORT)],
      {
        cwd: ROOT,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: {
          ...process.env,
          TEMPO_DEV_ROOT: ROOT,
          TEMPO_DEV_BRANCH: branch,
          TEMPO_DEV_ENV_SOURCE: envFile || "",
        },
        windowsHide: true,
      }
    );
    fs.closeSync(logFd);
    child.unref();
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ pid: child.pid, root: ROOT, branch, port: PORT, startedAt: new Date().toISOString() }, null, 2)
    );

    let status = await waitForTempo();
    if (!status) {
      throw new Error(`TEMPO did not become ready. Check ${LOG_FILE}`);
    }
    status = (await tempoStatus(true)) || status;
    printReady(status, false);
    if (status.backendReachable === false) {
      process.exitCode = 2;
    }
    if (!envFile) {
      console.warn("  Note: no .env.local was found in this worktree or the shared checkout.");
    }
  } finally {
    releaseLock();
  }
}

async function stop() {
  const status = await tempoStatus();
  if (!status) {
    if (await portIsOpen()) {
      throw new Error(`Port ${PORT} is not a coordinated TEMPO preview, so it was left alone.`);
    }
    console.log("The TEMPO preview is already stopped.");
    return;
  }

  const pid = Number(status.pid);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("The TEMPO preview did not report a safe process id; it was left running.");
  }
  const confirmed = await tempoStatus();
  if (!confirmed || Number(confirmed.pid) !== pid) {
    throw new Error("The TEMPO preview changed while it was being stopped; it was left alone.");
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await portIsOpen())) break;
    await sleep(250);
  }
  if (await portIsOpen()) {
    throw new Error(
      "The preview process could not be stopped with this tool's current permissions. Retry npm run dev:stop with process-control approval."
    );
  }
  fs.rmSync(STATE_FILE, { force: true });
  console.log(`Stopped the TEMPO preview that was serving:\n  ${describe(status)}`);
}

async function showStatus() {
  const status = await tempoStatus(true);
  if (!status) {
    console.log(
      (await portIsOpen())
        ? `Port ${PORT} is occupied by an older or uncoordinated server.`
        : "The TEMPO preview is stopped."
    );
    return;
  }
  printReady(status, true);
  console.log(`  Logs:    ${LOG_FILE}`);
}

async function main() {
  if (command === "ensure") return start();
  if (command === "status") return showStatus();
  if (command === "stop") return stop();
  if (command === "switch") {
    const status = await tempoStatus(true);
    if (status && path.resolve(status.root || "") === ROOT) {
      printReady(status, true);
      if (status.backendReachable === false) process.exitCode = 2;
      return;
    }
    if (status) await stop();
    return start();
  }
  throw new Error(`Unknown command "${command}". Use ensure, switch, status, or stop.`);
}

main().catch((error) => {
  console.error(`TEMPO preview: ${error.message}`);
  process.exitCode = 1;
});
