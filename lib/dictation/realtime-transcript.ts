export type TranscriptItem = {
  text: string;
  final: boolean;
};

export type TranscriptState = {
  order: string[];
  items: Record<string, TranscriptItem>;
};

export const EMPTY_TRANSCRIPT_STATE: TranscriptState = {
  order: [],
  items: {},
};

export type TranscriptUpdate = {
  itemId: string;
  text: string;
  kind: "delta" | "completed";
  previousItemId?: string | null;
};

function placeAfter(order: string[], itemId: string, previousItemId?: string | null): string[] {
  const withoutItem = order.filter((id) => id !== itemId);
  if (!previousItemId) return order.includes(itemId) ? order : [...order, itemId];

  const previousIndex = withoutItem.indexOf(previousItemId);
  if (previousIndex < 0) return order.includes(itemId) ? order : [...order, itemId];
  withoutItem.splice(previousIndex + 1, 0, itemId);
  return withoutItem;
}

/**
 * Realtime completion events can arrive out of order. Keep each speech turn by
 * item ID, then render it in conversation order instead of completion order.
 */
export function updateTranscript(
  state: TranscriptState,
  update: TranscriptUpdate,
): TranscriptState {
  const current = state.items[update.itemId];
  const nextText =
    update.kind === "completed"
      ? update.text
      : `${current?.text ?? ""}${update.text}`;

  return {
    order: placeAfter(state.order, update.itemId, update.previousItemId),
    items: {
      ...state.items,
      [update.itemId]: {
        text: nextText,
        final: update.kind === "completed",
      },
    },
  };
}

export function orderTranscriptItem(
  state: TranscriptState,
  itemId: string,
  previousItemId?: string | null,
): TranscriptState {
  if (!state.items[itemId]) return state;
  return { ...state, order: placeAfter(state.order, itemId, previousItemId) };
}

export function transcriptText(state: TranscriptState): string {
  return state.order
    .map((id) => state.items[id]?.text.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}
