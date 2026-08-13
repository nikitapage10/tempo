"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { showWebGlassAlert } from "@/components/notifications/web-glass-alert";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  onDesktopNotificationOpen,
  normalizeAccentHex,
  showDesktopNotification,
} from "@/lib/desktop/bridge";
import {
  incomingAlertKind,
  playIncomingAlert,
  primeIncomingAlertSounds,
} from "@/lib/notifications/incoming-alerts";
import { isMessagesSurface } from "@/lib/notifications/surface";
import { isDirectMessageSignal } from "@/lib/notifications/visibility";
import { createClient } from "@/lib/supabase/client";

type RealtimeNotification = {
  type?: string;
  title?: string;
  body?: string | null;
  link_url?: string | null;
};
const memberMessageTypes = new Set(["support_reply"]);
const adminMessageTypes = new Set(["support_member_reply", "support_new"]);

export function useRealtimeInbox(admin = false) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const palette = useActiveArtistPalette();
  // Shares the one `auth.getUser()` the app already makes, rather than asking
  // the auth server who we are a second time on every page load.
  const currentUser = useCurrentUser();
  const userId = currentUser?.id ?? null;
  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;

  const alertAccents = React.useMemo(
    () => ({
      ice: normalizeAccentHex(palette.ice) ?? palette.ice,
      amber: normalizeAccentHex(palette.amber) ?? palette.amber,
    }),
    [palette.amber, palette.ice]
  );

  React.useEffect(() => primeIncomingAlertSounds(), []);

  React.useEffect(
    () => onDesktopNotificationOpen((url) => window.location.assign(url)),
    []
  );

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tempo-inbox-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as RealtimeNotification;
          const alertKind = incomingAlertKind(notification.type);
          const title =
            notification.title ??
            (alertKind === "message" ? "New message" : "New notification");
          const link = notification.link_url?.trim() || null;

          if (isDirectMessageSignal(notification.type)) {
            void queryClient.invalidateQueries({ queryKey: ["messages"] });
            void queryClient.invalidateQueries({ queryKey: ["conversations"] });
            void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
            void queryClient.invalidateQueries({ queryKey: ["pulse-items"] });
          } else {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            void queryClient.invalidateQueries({
              queryKey: ["notifications-unread-count"],
            });
            if (memberMessageTypes.has(notification.type ?? "")) {
              void queryClient.invalidateQueries({ queryKey: ["messages"] });
              void queryClient.invalidateQueries({ queryKey: ["conversations"] });
              void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
              void queryClient.invalidateQueries({ queryKey: ["support-threads"] });
            }
            if (admin && adminMessageTypes.has(notification.type ?? "")) {
              void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
              void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
            }
          }

          // Already in Messages — refresh the thread quietly and jump to it
          // when we have a deep link. No glass toast or chime.
          if (alertKind === "message" && isMessagesSurface(pathnameRef.current)) {
            if (link) {
              const here = `${window.location.pathname}${window.location.search}`;
              if (here !== link) router.push(link);
            }
            return;
          }

          playIncomingAlert(alertKind);
          void (async () => {
            const shownOnDesktop = await showDesktopNotification({
              kind: alertKind,
              title,
              body: notification.body,
              url: link,
              ice: alertAccents.ice,
              amber: alertAccents.amber,
            });
            // Browser (and focused desktop) get the same glass card in-app —
            // bottom-right, above Get help — so new messages aren't silent on web.
            if (!shownOnDesktop) {
              showWebGlassAlert({
                kind: alertKind,
                title,
                body: notification.body,
                url: link,
                ice: alertAccents.ice,
                amber: alertAccents.amber,
              });
            }
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [admin, alertAccents.amber, alertAccents.ice, queryClient, router, userId]);
}
