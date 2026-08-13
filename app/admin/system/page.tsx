"use client";

import { CheckCircle2, HeartPulse, Mail, Radio, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAdminSystemHealth } from "@/hooks/use-admin";
import { summarizeSystemHealth } from "@/lib/admin/health-status";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AdminSystemPage() {
  const query = useAdminSystemHealth();
  const data = query.data;
  const summary = data ? summarizeSystemHealth(data) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        subtitle="Status and counts only — no secrets, emails, or private creative work."
      />
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="panel h-48 animate-pulse" />
          ))}
        </div>
      ) : null}
      {query.error ? (
        <div className="panel-quiet p-4 text-sm text-warn">{query.error.message}</div>
      ) : null}
      {data && summary ? (
        <>
          <section className="glass-hero prism-edge relative overflow-hidden p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-mono text-ice">Operational status</p>
                <h2
                  className={cn(
                    "mt-3 font-display text-2xl font-semibold tracking-tight",
                    summary.tone === "ok" ? "text-text-hi" : "text-amber"
                  )}
                >
                  {summary.tone === "ok" ? "Systems look steady." : "A few things need a look."}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-lo">
                  Last checked {timeAgo(data.checkedAt)}. TEMPO web v{APP_VERSION}.
                </p>
              </div>
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-full border",
                  summary.tone === "ok"
                    ? "border-ok/20 bg-ok/10 text-ok"
                    : "border-amber/20 bg-amber/10 text-amber"
                )}
              >
                {summary.tone === "ok" ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <HeartPulse className="size-5" />
                )}
              </span>
            </div>
            {summary.issues.length ? (
              <ul className="mt-5 space-y-2">
                {summary.issues.map((issue) => (
                  <li key={issue} className="text-sm text-text-hi">
                    {issue}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10 text-ice">
                  <Mail className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Invite email</p>
                  <p className="mt-1 text-xs text-text-lo">Presence of delivery settings only</p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Row
                  label="Configured"
                  value={data.emailDelivery.configured ? "Yes" : "No"}
                  ok={data.emailDelivery.configured}
                />
                <Row label="API key" value={data.emailDelivery.apiKeyPresent ? "Present" : "Missing"} />
                <Row label="From address" value={data.emailDelivery.fromPresent ? "Present" : "Missing"} />
                <Row label="Domain" value={data.emailDelivery.domain ?? "—"} />
                <Row
                  label="Webhook secret"
                  value={data.emailDelivery.webhookConfigured ? "Present" : "Missing"}
                />
              </dl>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-violet/20 bg-violet/10 text-violet">
                  <HeartPulse className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Schema</p>
                  <p className="mt-1 text-xs text-text-lo">Applied versus expected migration</p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Row
                  label="Ledger"
                  value={data.migrations.ledgerAvailable ? "Available" : "Not available"}
                  ok={data.migrations.ledgerAvailable}
                />
                <Row
                  label="Applied"
                  value={
                    data.migrations.latestAppliedVersion != null
                      ? String(data.migrations.latestAppliedVersion)
                      : "—"
                  }
                />
                <Row label="Expected" value={String(data.migrations.expectedLatestVersion)} />
                <Row
                  label="Up to date"
                  value={
                    data.migrations.upToDate == null
                      ? "Unknown"
                      : data.migrations.upToDate
                        ? "Yes"
                        : "No"
                  }
                  ok={data.migrations.upToDate === true}
                />
              </dl>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-ok/20 bg-ok/10 text-ok">
                  <Radio className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Product events · 24h</p>
                  <p className="mt-1 text-xs text-text-lo">Accept / reject / duplicate counts</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Well label="Accepted" value={data.productEvents.last24h.accepted} />
                <Well label="Rejected" value={data.productEvents.last24h.rejected} warn={data.productEvents.last24h.rejected > 0} />
                <Well label="Duplicate" value={data.productEvents.last24h.duplicate} />
              </div>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-amber/20 bg-amber/10 text-amber">
                  <Timer className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Pulse delivery</p>
                  <p className="mt-1 text-xs text-text-lo">Queue depth, never message bodies</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Well label="Pending" value={data.pulseDelivery.pending} />
                <Well label="Claimed" value={data.pulseDelivery.claimed} />
                <Well label="Retry" value={data.pulseDelivery.retry} warn={data.pulseDelivery.retry > 0} />
                <Well label="Failed" value={data.pulseDelivery.failed} warn={data.pulseDelivery.failed > 0} />
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Row label="Oldest waiting" value={timeAgo(data.pulseDelivery.oldestPendingScheduledFor)} />
                <Row label="Last successful send" value={timeAgo(data.pulseDelivery.lastSuccessfulSendAt)} />
                <Row
                  label="Scheduler"
                  value={data.scheduler.instrumented ? "Instrumented" : "Not yet instrumented"}
                />
              </dl>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-lo">{label}</dt>
      <dd className={cn("tabular-nums text-text-hi", ok === false && "text-amber")}>{value}</dd>
    </div>
  );
}

function Well({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="well p-3">
      <p className="text-[11px] uppercase tracking-wider text-text-lo">{label}</p>
      <p className={cn("mt-1 font-data text-xl tabular-nums", warn ? "text-amber" : "text-text-hi")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
