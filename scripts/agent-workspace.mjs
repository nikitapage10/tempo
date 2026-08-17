#!/usr/bin/env node
/**
 * CLI for the three-slot TEMPO agent workspace pool.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_SLOTS,
  DEFAULT_MAX_WAIT_MS,
  acquireWorkspace,
  releaseWorkspace,
  heartbeatWorkspace,
  getWorkspaceStatus,
  ensureWorktrees,
} from "./agent-workspace-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--wait") {
      flags.wait = true;
      continue;
    }
    if (arg === "--force") {
      flags.force = true;
      continue;
    }
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--task") {
      flags.task = argv[++i];
      continue;
    }
    if (arg === "--agent-id") {
      flags.agentId = argv[++i];
      continue;
    }
    if (arg === "--slot") {
      flags.slot = argv[++i];
      continue;
    }
    if (arg === "--max-wait-ms") {
      flags.maxWaitMs = Number(argv[++i]);
      continue;
    }
    if (arg === "--repo") {
      flags.repo = argv[++i];
      continue;
    }
    if (arg === "--tool") {
      flags.tool = argv[++i];
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }
  return { positional, flags };
}

function assertSlot(slot) {
  if (!WORKSPACE_SLOTS.includes(slot)) {
    throw new Error(
      `Invalid slot "${slot}". Expected one of: ${WORKSPACE_SLOTS.join(", ")}`,
    );
  }
}

function printHuman(lines) {
  process.stdout.write(`${lines.filter(Boolean).join("\n")}\n`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0] ?? "status";
  const mainRepoRoot = path.resolve(flags.repo ?? repoRoot);

  if (command === "ensure") {
    ensureWorktrees(mainRepoRoot);
    printHuman(["Ensured agent worktrees for Workspace 1–3."]);
    return;
  }

  if (command === "status") {
    const rows = getWorkspaceStatus(mainRepoRoot);
    if (flags.json) {
      process.stdout.write(`${JSON.stringify({ ok: true, slots: rows }, null, 2)}\n`);
      return;
    }
    for (const row of rows) {
      if (row.available) {
        printHuman([`${row.slot}: available → ${row.rootPath}`]);
      } else if (row.lease) {
        const tool = row.lease.tool ? `, ${row.lease.tool}` : "";
        printHuman([
          `${row.slot}: busy (pid ${row.lease.pid}${tool}, agent ${row.lease.agentId.slice(0, 8)}…) → ${row.rootPath}`,
        ]);
      } else {
        printHuman([`${row.slot}: stale lease (cleared on next acquire)`]);
      }
    }
    return;
  }

  if (command === "acquire") {
    const result = await acquireWorkspace({
      mainRepoRoot,
      wait: flags.wait ?? false,
      maxWaitMs:
        flags.maxWaitMs ??
        (process.env.TEMPO_AGENT_MAX_WAIT_MS
          ? Number(process.env.TEMPO_AGENT_MAX_WAIT_MS)
          : DEFAULT_MAX_WAIT_MS),
      agentId: flags.agentId,
      task: flags.task ?? process.env.TEMPO_AGENT_TASK,
      tool: flags.tool,
      ensure: true,
    });

    if (flags.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exitCode = result.ok ? 0 : 1;
      return;
    }

    if (result.ok) {
      printHuman([
        `Acquired ${result.slot}.`,
        `Root: ${result.rootPath}`,
        `Agent id: ${result.agentId}`,
        result.waitedMs > 0 ? `Waited ${Math.round(result.waitedMs / 1000)}s.` : "",
        "",
        "Open that folder in your editor before editing.",
        `Release when done: node scripts/agent-workspace.mjs release --agent-id ${result.agentId}`,
        "Export TEMPO_AGENT_ID=<id> in this shell so release/heartbeat find your lease.",
      ]);
      return;
    }

    printHuman([
      `Could not acquire a workspace (${result.reason}).`,
      ...result.slots.map((row) =>
        row.available ? `${row.slot}: available` : `${row.slot}: busy`,
      ),
      "",
      "Retry with: node scripts/agent-workspace.mjs acquire --wait",
    ]);
    process.exitCode = 1;
    return;
  }

  if (command === "release") {
    if (flags.slot) assertSlot(flags.slot);
    const result = await releaseWorkspace({
      mainRepoRoot,
      slot: flags.slot,
      agentId: flags.agentId ?? process.env.TEMPO_AGENT_ID,
      force: flags.force ?? false,
    });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exitCode = result.released ? 0 : 1;
      return;
    }
    printHuman([
      result.released
        ? `Released ${result.slot ?? "workspace"}.`
        : "Nothing released — slot not held by this agent.",
    ]);
    process.exitCode = result.released ? 0 : 1;
    return;
  }

  if (command === "heartbeat") {
    if (flags.slot) assertSlot(flags.slot);
    const ok = await heartbeatWorkspace({
      mainRepoRoot,
      slot: flags.slot,
      agentId: flags.agentId ?? process.env.TEMPO_AGENT_ID,
    });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify({ ok }, null, 2)}\n`);
      process.exitCode = ok ? 0 : 1;
      return;
    }
    printHuman([ok ? "Heartbeat recorded." : "Heartbeat failed — lease not found."]);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  throw new Error(
    `Unknown command "${command}". Use acquire | release | heartbeat | status | ensure`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
