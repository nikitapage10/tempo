// CI check: migration filenames must be numbered, and any NEW duplicate
// number must be caught before merge. Two pairs are already applied to
// production and must not be renamed (see CLAUDE.md): 058_* (member
// onboarding refinements / scenes slug reuse) and 080_* (desktop devices /
// hide unanswered Nikita welcomes). Grandfather those rather than treat
// them as errors.
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");
const GRANDFATHERED_DUPLICATE_NUMBERS = new Set([58, 80]);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+/.test(f) && f.endsWith(".sql"));

const byNumber = new Map();
for (const f of files) {
  const n = parseInt(f.match(/^(\d+)/)[1], 10);
  if (!byNumber.has(n)) byNumber.set(n, []);
  byNumber.get(n).push(f);
}

let failed = false;
for (const [n, group] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
  if (group.length > 1) {
    if (GRANDFATHERED_DUPLICATE_NUMBERS.has(n)) {
      console.log(`OK (grandfathered): migration number ${n} used by ${group.length} files: ${group.join(", ")}`);
    } else {
      console.error(`FAIL: migration number ${n} used by ${group.length} files: ${group.join(", ")}`);
      failed = true;
    }
  }
}

const numbers = [...byNumber.keys()].sort((a, b) => a - b);
console.log(`Checked ${files.length} migration files, numbers ${numbers[0]}-${numbers[numbers.length - 1]}.`);

if (failed) {
  console.error("\nMigration order check failed.");
  process.exit(1);
}
console.log("Migration order check passed.");
