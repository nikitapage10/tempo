"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { useAssistant } from "@/hooks/use-assistant";

const FOCUS_ROUTE = /^\/track\/[^/]+\/focus(\/|$)/;
const IMPORT_ROUTE = /^\/import(\/|$)/;

/**
 * Floating help assistant. Suppressed on Focus (distraction-free) and Import
 * (already a chat). Mounted inside AppShell so auth/guest routes stay clear.
 */
export function AssistantRoot() {
  const pathname = usePathname();
  const suppressed = FOCUS_ROUTE.test(pathname) || IMPORT_ROUTE.test(pathname);

  const {
    open,
    closePanel,
    togglePanel,
    turns,
    thinking,
    send,
    confirmAction,
    dismissAction,
    hasUnread,
  } = useAssistant();

  const panelRef = React.useRef<HTMLDivElement>(null);
  const launcherRef = React.useRef<HTMLButtonElement>(null);

  // Cmd/Ctrl+/ toggles; Escape closes and returns focus to the launcher.
  React.useEffect(() => {
    if (suppressed) return;

    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        togglePanel();
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        closePanel();
        launcherRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [suppressed, open, togglePanel, closePanel]);

  // Outside-click closes on desktop only.
  React.useEffect(() => {
    if (!open || suppressed) return;

    function onPointer(e: MouseEvent) {
      if (window.matchMedia("(max-width: 767px)").matches) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (launcherRef.current?.contains(target)) return;
      closePanel();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, suppressed, closePanel]);

  if (suppressed) return null;

  return (
    <>
      <AssistantLauncher
        open={open}
        hasUnread={hasUnread}
        onToggle={togglePanel}
        launcherRef={launcherRef}
      />
      <AssistantPanel
        open={open}
        turns={turns}
        thinking={thinking}
        onClose={closePanel}
        onSend={send}
        onConfirmAction={confirmAction}
        onDismissAction={dismissAction}
        panelRef={panelRef}
      />
    </>
  );
}
