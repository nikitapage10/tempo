import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { ASSISTANT_USAGE_COLUMNS, CREATED_AT_COLUMNS, FILE_USAGE_COLUMNS, SESSION_USAGE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const DAY_MS = 86_400_000;

function dayKey(value: string) { return value.slice(0, 10); }
function sum<T>(rows: T[], value: (row: T) => number) { return rows.reduce((total, row) => total + value(row), 0); }

export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  try {
    const service = createAdminClient();
    const now = Date.now();
    const start90 = new Date(now - 89 * DAY_MS).toISOString();
    const start30 = new Date(now - 29 * DAY_MS).toISOString().slice(0, 10);
    const [assistantResult, versionsResult, assetsResult, sessionsResult, tracksResult, projectsResult, authResult] = await Promise.all([
      service.from("assistant_usage").select(ASSISTANT_USAGE_COLUMNS),
      service.from("versions").select(FILE_USAGE_COLUMNS),
      service.from("assets").select(FILE_USAGE_COLUMNS),
      service.from("sessions").select(SESSION_USAGE_COLUMNS).gte("created_at", start90),
      service.from("tracks").select(CREATED_AT_COLUMNS).gte("created_at", start90),
      service.from("projects").select(CREATED_AT_COLUMNS).gte("created_at", start90),
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const assistant = assistantResult.data ?? [];
    const versions = versionsResult.data ?? [];
    const assets = assetsResult.data ?? [];
    const files = [...versions, ...assets];
    const sessions = sessionsResult.data ?? [];
    const tracks = tracksResult.data ?? [];
    const projects = projectsResult.data ?? [];
    const days = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(now - (89 - index) * DAY_MS).toISOString().slice(0, 10);
      const aiRows = assistant.filter((row) => dayKey(row.day) === date);
      const fileRows = files.filter((row) => dayKey(row.created_at) === date);
      const sessionRows = sessions.filter((row) => row.created_at && dayKey(row.created_at) === date);
      return {
        date,
        aiMessages: sum(aiRows, (row) => Number(row.messages) || 0),
        aiEscalations: sum(aiRows, (row) => Number(row.escalations) || 0),
        storageAddedBytes: sum(fileRows, (row) => Number(row.file_size) || 0),
        uploads: fileRows.length,
        focusSeconds: sum(sessionRows.filter((row) => row.status === "completed"), (row) => Number(row.elapsed_sec) || 0),
      };
    });
    const last30 = days.filter((day) => day.date >= start30);
    const assistant30 = assistant.filter((row) => dayKey(row.day) >= start30);
    return adminJson({
      totals: {
        aiMessages: sum(assistant, (row) => Number(row.messages) || 0),
        aiMessages30: sum(last30, (day) => day.aiMessages),
        aiEscalations30: sum(last30, (day) => day.aiEscalations),
        aiUsers30: new Set(assistant30.filter((row) => Number(row.messages) > 0).map((row) => row.user_id)).size,
        storageBytes: sum(files, (row) => Number(row.file_size) || 0),
        storageAdded30: sum(last30, (day) => day.storageAddedBytes),
        uploads30: sum(last30, (day) => day.uploads),
        focusSeconds30: sum(last30, (day) => day.focusSeconds),
        sessions30: sessions.filter((row) => row.created_at && dayKey(row.created_at) >= start30).length,
        tracks30: tracks.filter((row) => dayKey(row.created_at) >= start30).length,
        projects30: projects.filter((row) => dayKey(row.created_at) >= start30).length,
        members: authResult.data?.users.length ?? 0,
      },
      days,
      tracking: { aiCostAvailable: false, storageIncludes: ["bounces", "track assets"] },
    });
  } catch {
    return adminError("Couldn’t load usage analytics.", 500);
  }
}
