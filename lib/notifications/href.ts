import type { AppNotification } from "@/lib/types";

/** Best-effort deep link — panel tab depends on notification type. */
export function notificationHref(n: AppNotification): string {
  if (n.link_url) return n.link_url;
  if (!n.track_id) {
    if (n.entity_type === "conversation" && n.entity_id) {
      return `/messages?c=${n.entity_id}`;
    }
    if (n.entity_type === "post" && n.entity_id) {
      return `/social?post=${n.entity_id}`;
    }
    if (n.entity_type === "profile") {
      return "/social";
    }
    if (n.entity_type === "calendar_event" && n.entity_id) {
      return `/calendar?event=${n.entity_id}`;
    }
    return "/";
  }
  switch (n.type) {
    case "invite_accepted":
      return `/track/${n.track_id}?panel=people`;
    case "comment_reply":
    case "comment_assigned":
      return `/track/${n.track_id}?panel=comments`;
    case "new_version":
      return `/track/${n.track_id}`;
    default:
      return `/track/${n.track_id}`;
  }
}

export type NotificationBreadth =
  | "all"
  | "catalog"
  | "social"
  | "messages"
  | "calendar"
  | "support";

export const NOTIFICATION_BREADTH_LABELS: Record<NotificationBreadth, string> = {
  all: "All",
  catalog: "Catalog",
  social: "Social",
  messages: "Messages",
  calendar: "Calendar",
  support: "Support",
};

export function notificationBreadth(n: AppNotification): Exclude<NotificationBreadth, "all"> {
  const type = n.type ?? "";
  if (
    type.startsWith("support_") ||
    type === "support_reply" ||
    type === "support_new" ||
    type === "support_member_reply"
  ) {
    return "support";
  }
  if (type === "calendar_reminder" || n.entity_type === "calendar_event") {
    return "calendar";
  }
  if (
    type === "dm_message" ||
    n.entity_type === "conversation" ||
    type.startsWith("dm_")
  ) {
    return "messages";
  }
  if (
    type === "profile_follow" ||
    type === "post_like" ||
    type === "post_comment" ||
    type === "mention" ||
    n.entity_type === "post" ||
    n.entity_type === "profile" ||
    // Scenes notifications (join requests/approvals, invites, announcements,
    // events) always set link_url explicitly, since entity_id is a uuid and
    // scene routes are slug-based — notificationHref() above needs no scene
    // branch of its own because of that. This only sorts them into the
    // existing Social filter rather than adding a dedicated breadth.
    n.entity_type === "scene" ||
    n.entity_type === "scene_event" ||
    type.startsWith("scene_")
  ) {
    return "social";
  }
  return "catalog";
}

export function filterNotificationsByBreadth(
  items: AppNotification[],
  breadth: NotificationBreadth,
): AppNotification[] {
  if (breadth === "all") return items;
  return items.filter((n) => notificationBreadth(n) === breadth);
}
