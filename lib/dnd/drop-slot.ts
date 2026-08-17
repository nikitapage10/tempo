export type DropSlotKind = "track" | "note" | "task" | "pro";

export type DropSlot = {
  kind: DropSlotKind;
  containerId: string;
  beforeId: string | null;
};

export function dropSlotId(slot: DropSlot): string {
  return `slot:${slot.kind}:${slot.containerId}:${slot.beforeId ?? "end"}`;
}

export function parseDropSlotId(id: string): DropSlot | null {
  const match = /^slot:(track|note|task|pro):([^:]+):(.+)$/.exec(id);
  if (!match) return null;
  return {
    kind: match[1] as DropSlotKind,
    containerId: match[2],
    beforeId: match[3] === "end" ? null : match[3],
  };
}

export function sameDropSlot(a: DropSlot | null, b: DropSlot | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.kind === b.kind &&
    a.containerId === b.containerId &&
    a.beforeId === b.beforeId
  );
}
