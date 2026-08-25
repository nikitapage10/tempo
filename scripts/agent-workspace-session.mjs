#!/usr/bin/env node
/**
 * sessionStart helper: acquire or refresh a pool workspace lease.
 * Prints a single JSON line for Cursor hook additional_context.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireWorkspace,
  findLeaseForRoot,
  heartbeatWorkspace,
  getWorktreesRoot,
  resolveAgentTool,
  resolveMainRepoRoot,
} from "./agent-workspace-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveMainRepoRoot(path.resolve(__dirname, ".."));

function jsonOut(additionalContext) {
  const escaped = additionalContext
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  process.stdout.write(`{"additional_context":"${escaped}"}\n`);
}

async function main() {
  const tool = resolveAgentTool(process.env.TEMPO_AGENT_TOOL);
  const input = await new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
    });
    process.stdin.on("end", () => resolve(buf));
    setTimeout(() => resolve(buf), 50);
  });

  if (/\"is_background_agent\"\s*:\s*true/.test(input)) {
    process.stdout.write("{}\n");
    return;
  }

  const cwd = process.cwd();
  const worktreesRoot = path.resolve(getWorktreesRoot(repoRoot));
  const inPool =
    cwd === worktreesRoot ||
    cwd.startsWith(`${worktreesRoot}${path.sep}`);

  if (inPool) {
    const existing = findLeaseForRoot(repoRoot, cwd);
    if (existing) {
      await heartbeatWorkspace({
        mainRepoRoot: repoRoot,
        agentId: existing.lease.agentId,
      });
      jsonOut(
        `Already in ${existing.slot} (${cwd}). Agent id ${existing.lease.agentId}. Finish by integrating into local TEMPO and releasing: node scripts/agent-workspace.mjs release --agent-id ${existing.lease.agentId}`,
      );
      return;
    }
  }

  const maxWaitMs = process.env.TEMPO_AGENT_HOOK_MAX_WAIT_MS
    ? Number(process.env.TEMPO_AGENT_HOOK_MAX_WAIT_MS)
    : 120_000;

  const result = await acquireWorkspace({
    mainRepoRoot: repoRoot,
    wait: true,
    maxWaitMs,
    tool,
    task: `${tool}-session`,
  });

  if (result.ok) {
    jsonOut(
      [
        `Acquired ${result.slot} for this session (${tool}).`,
        `Root path: ${result.rootPath}`,
        `Agent id: ${result.agentId}`,
        result.waitedMs > 0
          ? `Waited ${Math.round(result.waitedMs / 1000)}s for a free workspace.`
          : "",
        "REQUIRED before editing: open that folder as your project root (Cursor: move_agent_to_root; Claude/Codex: cd there).",
        `Export TEMPO_AGENT_ID=${result.agentId}. When done, integrate into local TEMPO and release: node scripts/agent-workspace.mjs release --agent-id ${result.agentId}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return;
  }

  jsonOut(
    [
      "All three agent workspaces (Workspace 1–3) are busy.",
      "Before editing, run: node scripts/agent-workspace.mjs acquire --wait",
      "Then move_agent_to_root to the returned root path.",
      "Do not edit the shared TEMPO checkout while waiting.",
    ].join(" "),
  );
}

main().catch((error) => {
  jsonOut(
    `Agent workspace acquire failed: ${error instanceof Error ? error.message : String(error)}`,
  );
});
