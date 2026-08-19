import { describe, expect, it } from "vitest";
import { cleanSessionRecap } from "@/lib/sessions/recap-schema";

describe("Session recap schema", () => {
  it("caps proposals and removes empty rows", () => {
    const recap = cleanSessionRecap({
      summary: `  ${"x".repeat(700)}  `,
      decisions: [" Keep the bridge ", "", ...Array.from({ length: 10 }, (_, index) => `Decision ${index}`)],
      tasks: [
        { title: "  Send stems  ", assigneeName: " Nikita ", dueDate: "2026-08-20" },
        { title: "", assigneeName: null, dueDate: "tomorrow" },
      ],
      agendaDone: [" Verse ", ""],
    });
    expect(recap.summary).toHaveLength(600);
    expect(recap.decisions).toHaveLength(8);
    expect(recap.decisions[0]).toBe("Keep the bridge");
    expect(recap.tasks).toEqual([{ title: "Send stems", assigneeName: "Nikita", dueDate: "2026-08-20" }]);
    expect(recap.agendaDone).toEqual(["Verse"]);
  });

  it("drops dates that are not ISO calendar values", () => {
    const recap = cleanSessionRecap({
      summary: "",
      decisions: [],
      tasks: [{ title: "Check mix", assigneeName: null, dueDate: "Friday" }],
      agendaDone: [],
    });
    expect(recap.tasks[0]?.dueDate).toBeNull();
  });
});
