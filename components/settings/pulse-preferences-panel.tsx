"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
  browserTimezone,
  type DigestFrequency,
  type NotificationPreferences,
} from "@/lib/api/notification-preferences";
import { recordProductEvent } from "@/lib/product-events/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CATEGORY_FIELDS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: "category_due", label: "Due soon" },
  { key: "category_attention", label: "Needs attention" },
  { key: "category_feedback", label: "Feedback" },
  { key: "category_collaboration", label: "Collaboration" },
  { key: "category_messages", label: "Messages (count only)" },
  { key: "category_calendar", label: "Calendar" },
  { key: "category_progress", label: "Progress (weekly only)" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PulsePreferencesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: prefs, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: ensureNotificationPreferences,
    retry: 1,
  });

  const [saving, setSaving] = React.useState(false);

  async function save(patch: Partial<Omit<NotificationPreferences, "user_id">>) {
    setSaving(true);
    try {
      const updated = await updateNotificationPreferences(patch);
      queryClient.setQueryData(["notification-preferences"], updated);
      recordProductEvent("pulse_preferences_updated", {
        frequency: updated.digest_frequency,
        include_entity_names: updated.include_entity_names,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save that preference.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-card bg-bg-2" />;
  }

  if (error || !prefs) {
    return (
      <div className="panel-quiet p-5 text-sm text-warn">
        <p>Couldn’t load your Pulse settings right now.</p>
        <p className="mt-1 text-xs text-text-lo">
          {(error as { message?: string } | null)?.message ?? "Please try again in a moment."}
        </p>
        <button
          type="button"
          className="mt-3 text-xs text-ice hover:underline disabled:opacity-50"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          {isRefetching ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("panel space-y-5 p-5", saving && "opacity-80")}>
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
          <Sparkles className="size-4 text-ice" />
        </div>
        <div>
          <p className="font-display text-base font-semibold tracking-tight text-text-hi">
            TEMPO Pulse
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-lo">
            A coherent briefing instead of a stream of transactional email.
            In-app Pulse is always on. Email is off until you turn it on.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-lo">Email Pulse</span>
          <select
            className="rounded-input border border-line bg-bg-2 px-3 py-2 text-text-hi"
            value={prefs.digest_frequency}
            onChange={(e) => {
              const frequency = e.target.value as DigestFrequency;
              // The DB constraint requires weekly_delivery_day whenever
              // frequency is "weekly" — set both in the same write so an
              // intermediate state never violates it.
              save(
                frequency === "weekly" && !prefs.weekly_delivery_day
                  ? { digest_frequency: frequency, weekly_delivery_day: 1 }
                  : { digest_frequency: frequency }
              );
            }}
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-lo">Local delivery time</span>
          <input
            type="time"
            className="rounded-input border border-line bg-bg-2 px-3 py-2 text-text-hi"
            value={prefs.delivery_local_time?.slice(0, 5) ?? "08:00"}
            onChange={(e) => save({ delivery_local_time: e.target.value })}
          />
        </label>

        {prefs.digest_frequency === "weekly" ? (
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-text-lo">Weekly delivery day</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day, i) => {
                const iso = i + 1;
                const active = prefs.weekly_delivery_day === iso;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => save({ weekly_delivery_day: iso })}
                    className={cn(
                      "rounded-chip border px-2.5 py-1 text-xs transition-colors duration-hover",
                      active
                        ? "border-ice/30 bg-ice/10 text-text-hi"
                        : "border-line bg-bg-2/40 text-text-lo hover:text-text-hi"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-text-lo">Timezone</span>
          <div className="flex items-center gap-2">
            <span className="font-data text-sm text-text-hi">{prefs.timezone}</span>
            <button
              type="button"
              className="text-xs text-ice hover:underline"
              onClick={() => save({ timezone: browserTimezone() })}
            >
              Use this device&apos;s timezone
            </button>
          </div>
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm text-text-lo">Categories in the digest</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORY_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-text-hi">
              <input
                type="checkbox"
                checked={Boolean(prefs[key])}
                onChange={(e) => save({ [key]: e.target.checked } as Partial<NotificationPreferences>)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-text-lo">Immediate email for high-value moments</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-hi">
            <input
              type="checkbox"
              checked={prefs.immediate_guest_feedback}
              onChange={(e) => save({ immediate_guest_feedback: e.target.checked })}
            />
            New guest feedback
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-hi">
            <input
              type="checkbox"
              checked={prefs.immediate_collaboration}
              onChange={(e) => save({ immediate_collaboration: e.target.checked })}
            />
            Collaboration invites
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-hi">
            <input
              type="checkbox"
              checked={prefs.immediate_message_awareness}
              onChange={(e) => save({ immediate_message_awareness: e.target.checked })}
            />
            New message awareness (count only)
          </label>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-text-hi">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={prefs.include_entity_names}
          onChange={(e) => save({ include_entity_names: e.target.checked })}
        />
        <span>
          Include track and project names in email
          <span className="block text-xs text-text-lo">
            Off by default during beta — emails otherwise use generic
            wording like &quot;2 tracks need feedback.&quot;
          </span>
        </span>
      </label>
    </div>
  );
}
