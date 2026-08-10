import { config as loadEnv } from "dotenv";
import path from "node:path";
import { assertSafeTestSupabaseEnv } from "./test-env-guard";

// Load the isolated test project's credentials. Never .env.local.
loadEnv({ path: path.resolve(__dirname, "../../.env.test.local") });

assertSafeTestSupabaseEnv();
