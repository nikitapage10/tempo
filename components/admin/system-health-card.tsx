"use client";

import Link from "next/link";
import { ArrowRight, HeartPulse } from "lucide-react";
import { useAdminSystemHealth } from "@/hooks/use-admin";
import { summarizeSystemHealth } from "@/lib/admin/health-status";
import { cn } from "@/lib/utils";

export function SystemHealthCard() {
  const query = useAdminSystemHealth();
  if (query.isLoading) return <div className="panel h-48 animate-pulse" />;
  if (query.error) {
    return <div className="panel-quiet p-4 text-sm text-warn">{query.error.message}</div>;
  }
  if (!query.data) return null;
  const summary = summarizeSystemHealth(query.data);
  const data = query.data;
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono">System</p>
          <p className={cn("mt-2 text-sm", summary.tone === "ok" ? "text-ok" : "text-amber")}>
            {summary.label}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full border",
            summary.tone === "ok"
              ? "border-ok/20 bg-ok/10 text-ok"
              : "border-amber/20 bg-amber/10 text-amber"
          )}
        >
          <HeartPulse className="size-4" />
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <HealthWell
          label="Email"
          value={data.emailDelivery.configured ? "Ready" : "Needs setup"}
          ok={data.emailDelivery.configured}
        />
        <HealthWell
          label="Schema"
          value={
            data.migrations.upToDate
              ? "Current"
              : data.migrations.ledgerAvailable
                ? "Behind"
                : "Unknown"
          }
          ok={data.migrations.upToDate === true}
        />
        <HealthWell
          label="Events · 24h"
          value={String(data.productEvents.last24h.accepted)}
          ok={data.productEvents.last24h.rejected === 0}
        />
        <HealthWell
          label="Pulse failed"
          value={String(data.pulseDelivery.failed)}
          ok={data.pulseDelivery.failed === 0}
        />
      </div>
      {summary.issues.length ? (
        <ul className="mt-4 space-y-1">
          {summary.issues.slice(0, 3).map((issue) => (
            <li key={issue} className="text-xs leading-relaxed text-text-lo">
              {issue}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-text-lo">
          Invite mail, schema, events, and Pulse delivery look clear. Private work stays out of this view.
        </p>
      )}
      <Link
        href="/admin/system"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-ice hover:underline"
      >
        Open system health
        <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

function HealthWell({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="well p-3">
      <p className="text-[11px] uppercase tracking-wider text-text-lo">{label}</p>
      <p className={cn("mt-1 text-sm tabular-nums", ok ? "text-text-hi" : "text-amber")}>{value}</p>
    </div>
  );
}
