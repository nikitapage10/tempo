// Runs `next dev` pointed at the isolated test Supabase project, never
// production — used only for manual/browser-preview verification of
// AR-1..AR-8 work. Loads .env.test.local explicitly so it can't fall back
// to the real .env.local sitting in the same directory.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.test.local") });

const PRODUCTION_REF = "bbzzaboqhvqpeoxbyiun";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes(PRODUCTION_REF)) {
  console.error("Refusing to start: NEXT_PUBLIC_SUPABASE_URL is missing or points at production.");
  process.exit(1);
}

process.env.DEV_TEST_EMAIL = process.env.DEV_TEST_EMAIL || "owner.fixture@tempo.test";

const { spawn } = require("child_process");
const port = process.env.PORT || "3200";
const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
