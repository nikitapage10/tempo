"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import {
  useNotificationMutations,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications";
import { formatShortDate } from "@/lib/format";
import { notificationHref } from "@/lib/notifications/href";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications(20);
  const { read, readAll } = useNotificationMutations();

  React.useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="relative flex size-8 items-center justify-center rounded-input text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Bell className="size-4" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber font-mono text-[9px] font-bold text-bg-0">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-16 z-[60] max-h-[75vh] overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1.5 sm:w-80 sm:max-w-[calc(100vw-1.5rem)] sm:max-h-none">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
              Notifications
            </h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-ice hover:underline"
                onClick={() => readAll.mutate()}
              >
                <Check className="size-3" />
                Mark all read
              </button>
            ) : null}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <li className="p-4">
                <div className="h-10 animate-pulse rounded-card bg-bg-2" />
              </li>
            ) : notifications.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-text-lo">
                Nothing yet. Invite replies, new versions, and comment activity show up here.
              </li>
            ) : (
              notifications.map((n) => {
                const unread = !n.read_at;
                return (
                  <li key={n.id}>
                    <Link
                      href={notificationHref(n)}
                      onClick={() => {
                        setOpen(false);
                        if (unread) read.mutate(n.id);
                      }}
                      className={cn(
                        "block border-b border-line/60 px-3 py-2.5 transition-colors duration-hover hover:bg-bg-2/60",
                        unread && "bg-ice/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {unread ? (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ice" />
                        ) : (
                          <span className="mt-1.5 size-1.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-hi">{n.title}</p>
                          {n.body ? (
                            <p className="mt-0.5 truncate text-xs text-text-lo">{n.body}</p>
                          ) : null}
                          <p className="mt-1 font-mono text-[10px] text-text-lo/70">
                            {formatShortDate(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-line px-3 py-2">
            <Link
              href="/settings?tab=notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] text-ice hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
