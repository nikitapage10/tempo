import { describe, expect, it } from "vitest";
import { parseNaturalSchedule } from "@/lib/calendar/natural-language";

const TODAY = "2024-01-17"; // a Wednesday

describe("calendar natural-language create", () => {
  it("parses a weekday and a time into a studio session", () => {
    const parsed = parseNaturalSchedule("Studio session Friday at 7pm", TODAY);
    expect(parsed.date).toBe("2024-01-19");
    expect(parsed.time).toBe("19:00");
    expect(parsed.kind).toBe("studio_session");
    expect(parsed.title).toBe("Studio session");
    expect(parsed.task).toBe(false);
  });

  it("understands tomorrow and 24h-adjacent am/pm parsing", () => {
    const parsed = parseNaturalSchedule("Mix review tomorrow at 9:30am", TODAY);
    expect(parsed.date).toBe("2024-01-18");
    expect(parsed.time).toBe("09:30");
    expect(parsed.kind).toBe("other");
  });

  it("defaults to today with no date and no time when neither is present", () => {
    const parsed = parseNaturalSchedule("Send the rider to the venue", TODAY);
    expect(parsed.date).toBe(TODAY);
    expect(parsed.time).toBeNull();
    expect(parsed.title).toBe("Send the rider to the venue");
  });

  it("creates a task instead of an event with a leading task: prefix", () => {
    const parsed = parseNaturalSchedule("task: mix notes tomorrow", TODAY);
    expect(parsed.task).toBe(true);
    expect(parsed.date).toBe("2024-01-18");
    expect(parsed.title).toBe("mix notes");
  });

  it("falls back to a placeholder title when everything is stripped", () => {
    const parsed = parseNaturalSchedule("tomorrow at 7pm", TODAY);
    expect(parsed.title).toBe("Scheduled work");
  });
});
