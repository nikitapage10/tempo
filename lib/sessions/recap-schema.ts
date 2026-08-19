export type SessionRecap = {
  summary: string;
  decisions: string[];
  tasks: { title: string; assigneeName: string | null; dueDate: string | null }[];
  agendaDone: string[];
};

export const SESSION_RECAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "decisions", "tasks", "agendaDone"],
  properties: {
    summary: { type: "string", maxLength: 600 },
    decisions: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 180 },
    },
    tasks: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "assigneeName", "dueDate"],
        properties: {
          title: { type: "string", maxLength: 100 },
          assigneeName: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
        },
      },
    },
    agendaDone: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 200 },
    },
  },
} as const;

export function cleanSessionRecap(value: SessionRecap): SessionRecap {
  return {
    summary: String(value.summary ?? "").trim().slice(0, 600),
    decisions: (value.decisions ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 8),
    tasks: (value.tasks ?? [])
      .map((task) => ({
        title: String(task.title ?? "").trim().slice(0, 100),
        assigneeName: task.assigneeName ? String(task.assigneeName).trim() : null,
        dueDate: task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : null,
      }))
      .filter((task) => task.title)
      .slice(0, 8),
    agendaDone: (value.agendaDone ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 20),
  };
}
