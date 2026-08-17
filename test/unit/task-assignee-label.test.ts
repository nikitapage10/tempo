import { describe, expect, it } from "vitest";
import {
  buildTaskAssigneeOptions,
  taskPersonLabel,
} from "@/lib/tasks/assignee-label";

describe("taskPersonLabel", () => {
  it("prefers a real person name over placeholders", () => {
    expect(
      taskPersonLabel(["Your work", "Nick Miller"], "You", "nick@example.com")
    ).toBe("Nick Miller");
    expect(taskPersonLabel(["Your work"], "You", "nick@example.com")).toBe(
      "You"
    );
  });
});

describe("buildTaskAssigneeOptions", () => {
  it("labels you with your name in a Pro home, not Artist owner", () => {
    expect(
      buildTaskAssigneeOptions({
        currentUserId: "nick",
        currentUserEmail: "nick@example.com",
        currentUserName: "Nick Miller",
        ownerUserId: "nick",
        ownerWorkspaceName: "Your work",
        memberNames: new Map(),
        eligibleUserIds: [],
      })
    ).toEqual([{ userId: "nick", label: "Nick Miller" }]);
  });

  it("lists the workspace owner first, then you, then teammates", () => {
    expect(
      buildTaskAssigneeOptions({
        currentUserId: "pro",
        currentUserEmail: "pro@example.com",
        currentUserName: "Nick Miller",
        ownerUserId: "artist",
        ownerWorkspaceName: "PRESIDENT",
        memberNames: new Map([
          ["artist", "Maya Chen"],
          ["teammate", "Alex Rivera"],
        ]),
        eligibleUserIds: ["teammate"],
      })
    ).toEqual([
      { userId: "artist", label: "Maya Chen" },
      { userId: "pro", label: "Nick Miller" },
      { userId: "teammate", label: "Alex Rivera" },
    ]);
  });

  it("does not duplicate you when you are the owner", () => {
    const options = buildTaskAssigneeOptions({
      currentUserId: "nick",
      currentUserEmail: "nick@example.com",
      currentUserName: "Nick Miller",
      ownerUserId: "nick",
      ownerWorkspaceName: "Nick Miller",
      memberNames: new Map(),
      eligibleUserIds: ["nick"],
    });
    expect(options).toEqual([{ userId: "nick", label: "Nick Miller" }]);
  });
});
