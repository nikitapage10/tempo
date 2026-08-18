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
    if (arg === "--allow-dirty") {
      flags.allowDirty = true;
      continue;
    }
    if (arg === "--no-sync") {
      flags.sync = false;
      continue;
    }
    if (arg === "--owner-pid") {
      flags.ownerPid = Number(argv[++i]);
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
      if (row.available && !row.worktree.clean) {
        const where = row.worktree.branch ? ` on ${row.worktree.branch}` : "";
        printHuman([
          `${row.slot}: needs cleanup — ${row.worktree.dirtyCount} uncommitted file(s)${where} → ${row.rootPath}`,
          row.worktree.dirtySample?.length
            ? `    ${row.worktree.dirtySample.join(", ")}${row.worktree.dirtyCount > row.worktree.dirtySample.length ? ", …" : ""}`
            : "",
        ]);
      } else if (row.available) {
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
    if (flags.slot) assertSlot(flags.slot);
    const result = await acquireWorkspace({
      mainRepoRoot,
      slot: flags.slot,
      allowDirty: flags.allowDirty ?? false,
      sync: flags.sync ?? true,
      ownerPid: Number.isFinite(flags.ownerPid) ? flags.ownerPid : undefined,
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
        result.sync?.synced
          ? `Synced to ${result.sync.from} (${result.sync.at}).`
          : `Not synced to main (${result.sync?.reason ?? "unknown"}) — rebase before you push.`,
        result.waitedMs > 0 ? `Waited ${Math.round(result.waitedMs / 1000)}s.` : "",
        "",
        "Open that folder in your editor before editing.",
        `Release when done: node scripts/agent-workspace.mjs release --agent-id ${result.agentId}`,
        "Export TEMPO_AGENT_ID=<id> in this shell so release/heartbeat find your lease.",
        "Long session? Refresh the lease every few minutes:",
        `  node scripts/agent-workspace.mjs heartbeat --agent-id ${result.agentId}`,
      ]);
      return;
    }

    if (result.reason === "free_slots_dirty") {
      printHuman([
        "Could not acquire a workspace — every free slot still holds uncommitted work.",
        "",
        ...result.dirtySlots.flatMap((row) => [
          `${row.slot}: ${row.dirtyCount} uncommitted file(s)${row.branch ? ` on ${row.branch}` : ""}`,
          `  ${row.rootPath}`,
          row.dirtySample?.length ? `  ${row.dirtySample.join(", ")}` : "",
        ]),
        "",
        "Someone's work is sitting there. Commit it, stash it, or clear it, then retry.",
        "To take the slot anyway (this does NOT delete their files, you just share the desk):",
        "  node scripts/agent-workspace.mjs acquire --allow-dirty",
      ]);
      process.exitCode = 1;
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
    `Unknown command "${command}". Use acquire | release | heartbeat | status | ensure\n` +
      "acquire flags: --wait --json --slot \"Workspace 2\" --allow-dirty --no-sync --owner-pid <pid> --task <text> --tool <name>",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
