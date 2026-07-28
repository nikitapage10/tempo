"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { askAssistant } from "@/lib/api/assistant";
import type { AssistantAttachment } from "@/lib/assistant/attachments";
import { executeProposedAction } from "@/lib/assistant/actions";
import type { ProposedAction, RefMap, Turn } from "@/lib/assistant/types";
import { MAX_MESSAGE_CHARS } from "@/lib/assistant/types";
import { useActiveSpace } from "@/components/active-space-provider";
import { useStages } from "@/hooks/use-stages";
import { useToast } from "@/components/ui/toast";

const HISTORY_CAP = 8;

export function useAssistant() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeSpaceId } = useActiveSpace();
  const stagesQuery = useStages(activeSpaceId);
  const firstStageId = stagesQuery.data?.[0]?.id ?? null;

  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [escalationsUsed, setEscalationsUsed] = React.useState(0);
  const [refs, setRefs] = React.useState<RefMap>({});
  const [hasUnread, setHasUnread] = React.useState(false);

  const openPanel = React.useCallback(() => {
    setOpen(true);
    setHasUnread(false);
  }, []);

  const closePanel = React.useCallback(() => {
    setOpen(false);
  }, []);

  const togglePanel = React.useCallback(() => {
    setOpen((prev) => {
      if (!prev) setHasUnread(false);
      return !prev;
    });
  }, []);

  const send = React.useCallback(
    async (raw: string, attachments: AssistantAttachment[] = []) => {
      const message = raw.trim().slice(0, MAX_MESSAGE_CHARS);
      if ((!message && attachments.length === 0) || thinking) return;

      const displayText =
        message ||
        (attachments.length === 1
          ? `Attached ${attachments[0]!.name}`
          : `Attached ${attachments.length} files`);

      const artistTurn: Turn = {
        id: crypto.randomUUID(),
        role: "artist",
        text: displayText,
        attachmentNames: attachments.map((a) => a.name),
      };
      setTurns((prev) => [...prev, artistTurn]);
      setThinking(true);

      try {
        const history = [...turns, artistTurn]
          .slice(-HISTORY_CAP)
          .map((t) => ({ role: t.role, text: t.text }));

        const res = await askAssistant({
          message,
          history: history.slice(0, -1),
          escalationsUsed,
          activeSpaceId,
          attachments,
        });

        if (res.escalated) {
          setEscalationsUsed((n) => n + 1);
        }
        if (res.refs && Object.keys(res.refs).length) {
          setRefs((prev) => ({ ...prev, ...res.refs }));
        }

        const tempoTurn: Turn = {
          id: crypto.randomUUID(),
          role: "tempo",
          text: res.reply,
          action: res.action,
          actionStatus: res.action ? "pending" : undefined,
          suggestions: res.suggestions,
        };
        setTurns((prev) => [...prev, tempoTurn]);

        if (!open) setHasUnread(true);
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "tempo",
            text: "Something went wrong reaching the assistant. Try again.",
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, turns, escalationsUsed, activeSpaceId, open],
  );

  const confirmAction = React.useCallback(
    async (turnId: string, action: ProposedAction) => {
      try {
        const result = await executeProposedAction(action, {
          refs,
          activeSpaceId,
          firstStageId,
          router,
          onWrote: () => {
            void qc.invalidateQueries({ queryKey: ["tasks"] });
            void qc.invalidateQueries({ queryKey: ["tracks"] });
            void qc.invalidateQueries({ queryKey: ["projects"] });
            void qc.invalidateQueries({ queryKey: ["dashboard"] });
          },
        });
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  actionStatus: "done",
                  actionDoneLabel: result.doneLabel,
                }
              : t,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Couldn't do that just now.";
        toast(msg, "error");
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, actionStatus: "failed" } : t,
          ),
        );
      }
    },
    [refs, activeSpaceId, firstStageId, router, qc, toast],
  );

  const dismissAction = React.useCallback((turnId: string) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turnId ? { ...t, actionStatus: "dismissed" } : t,
      ),
    );
  }, []);

  return {
    open,
    openPanel,
    closePanel,
    togglePanel,
    turns,
    thinking,
    send,
    confirmAction,
    dismissAction,
    hasUnread,
    refs,
  };
}
