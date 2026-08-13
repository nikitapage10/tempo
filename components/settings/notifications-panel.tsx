"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, Trash2 } from "lucide-react";
import {
  useNotificationMutations,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications";
import { formatShortDate } from "@/lib/format";
import {
  NOTIFICATION_BREADTH_LABELS,
  filterNotificationsByBreadth,
  notificationBreadth,
  notificationHref,
  type NotificationBreadth,
} from "@/lib/notifications/href";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BREADTHS: NotificationBreadth[] = [
  "all",
  "catalog",
  "social",
  "calendar",
  "support",
];

export function NotificationsPanel() {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications(200);
  const { read, readAll, remove } = useNotificationMutations();
  const [breadth, setBreadth] = React.useState<NotificationBreadth>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = filterNotificationsByBreadth(notifications, breadth);
    if (unreadOnly) list = list.filter((n) => !n.read_at);
    return list;
  }, [notifications, breadth, unreadOnly]);

  const counts = React.useMemo(() => {
    const next: Record<NotificationBreadth, number> = {
      all: notifications.length,
      catalog: 0,
      social: 0,
      messages: 0,
      calendar: 0,
      support: 0,
    };
    for (const n of notifications) {
      next[notificationBreadth(n)] += 1;
    }
    return next;
  }, [notifications]);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <Bell className="size-4 text-ice" />
          </div>
          <div>
            <p className="text-sm text-text-hi">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You’re caught up"}
            </p>
            <p className="mt-1 text-xs text-text-lo">
              Catalog, social, calendar, and support — the full history lives
              here. Messages keep their own unread badge in the inbox.
            </p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            <Check className="size-3.5" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BREADTHS.map((key) => {
          const count = counts[key];
          const active = breadth === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setBreadth(key)}
              className={cn(
                "rounded-chip border px-2.5 py-1 text-xs transition-colors duration-hover",
                active
                  ? "border-ice/30 bg-ice/10 text-text-hi"
                  : "border-line bg-bg-2/40 text-text-lo hover:border-ice/20 hover:text-text-hi",
              )}
            >
              {NOTIFICATION_BREADTH_LABELS[key]}
              {key !== "all" && count > 0 ? (
                <span className="ml-1 tabular-nums text-text-lo">{count}</span>
              ) : null}
            </button>
          );
        })}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-text-lo">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </div>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-14 animate-pulse rounded-input bg-bg-2" />
            <div className="h-14 animate-pulse rounded-input bg-bg-2" />
            <div className="h-14 animate-pulse rounded-input bg-bg-2" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-text-lo">
            {notifications.length === 0
              ? "Nothing yet. Invite replies, new versions, and comment activity show up here."
              : "Nothing in this filter."}
          </p>
        ) : (
          <ul>
            {filtered.map((n) => {
              const unread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-stretch border-b border-line/60 last:border-b-0",
                    unread && "bg-ice/5",
                  )}
                >
                  <Link
                    href={notificationHref(n)}
                    onClick={() => {
                      if (unread) read.mutate(n.id);
                    }}
                    className="min-w-0 flex-1 px-4 py-3 transition-colors duration-hover hover:bg-bg-2/50"
                  >
                    <div className="flex items-start gap-2">
                      {unread ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ice" />
                      ) : (
                        <span className="mt-1.5 size-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-sm text-text-hi">{n.title}</p>
                          <span className="label-mono text-[11px] text-text-lo/70">
                            {NOTIFICATION_BREADTH_LABELS[notificationBreadth(n)]}
                          </span>
                        </div>
                        {n.body ? (
                          <p className="mt-0.5 text-xs leading-relaxed text-text-lo">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 font-data text-xs tabular-nums text-text-lo/70">
                          {formatShortDate(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    className="shrink-0 px-3 text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-warn"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
