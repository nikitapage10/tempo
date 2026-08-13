"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  HardDrive,
  LifeBuoy,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { MemberJump } from "@/components/admin/member-jump";
import { StatTile } from "@/components/admin/stat-tile";
import { SystemHealthCard } from "@/components/admin/system-health-card";
import { UsageChart } from "@/components/admin/usage-chart";
import { Button } from "@/components/ui/button";
import { useAdminOverview } from "@/hooks/use-admin";
import type { AdminOverviewAudit } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

function bytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Progress({
  label,
  value,
  total,
  tone = "ice",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "ice" | "amber" | "ok";
}) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  const color = tone === "amber" ? "bg-amber" : tone === "ok" ? "bg-ok" : "bg-ice";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-lo">{label}</span>
        <span className="tabular-nums text-text-hi">{value.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-3">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HeroStat({
  value,
  label,
  tone,
}: {
  value: number | undefined;
  label: string;
  tone?: "amber";
}) {
  return (
    <div>
      <p
        className={cn(
          "stat-value",
          value === undefined || value === 0
            ? "text-text-lo/50"
            : tone === "amber"
              ? "text-amber"
              : "text-text-hi"
        )}
      >
        {value ?? "—"}
      </p>
      <p className="label-mono mt-2">{label}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useAdminOverview();
  const attention = data ? data.openReports + data.openSupportReports : 0;
  const activeRate = data?.totalMembers
    ? Math.round((data.active30 / data.totalMembers) * 100)
    : 0;
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {isLoading ? (
        <>
          <div className="glass-hero h-64 animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="panel h-32 animate-pulse" />
            ))}
          </div>
        </>
      ) : null}
      {error ? <div className="panel-quiet p-4 text-sm text-warn">{error.message}</div> : null}
      {data ? (
        <>
          <section className="glass-hero prism-edge relative overflow-hidden">
            <div className="absolute inset-0">
              <LfWindow field className="absolute inset-0" aria-hidden />
              <div className="scrim-reveal absolute inset-0" aria-hidden />
            </div>
            <div className="relative z-[1] grid gap-8 px-6 py-7 sm:px-8 sm:py-9 md:grid-cols-[minmax(0,1.35fr)_auto] md:items-center">
              <div>
                <p className="label-mono text-amber">Private operations</p>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-[0.02em] text-text-hi sm:text-[40px] sm:leading-[1.05]">
                  {greetingForHour(now.getHours())}
                </h1>
                <p className="mt-1.5 text-sm text-text-lo">{dateLabel}</p>
                <h2 className="mt-5 max-w-xl font-display text-xl font-semibold tracking-tight text-text-hi sm:text-2xl">
                  {attention === 0
                    ? "Everything is moving cleanly."
                    : `${attention} ${attention === 1 ? "item needs" : "items need"} a decision.`}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-lo">
                  {data.active30} of {data.totalMembers} members were active in the last 30 days.
                  Private creative work stays outside this view.
                </p>
                <div className="mt-6 flex flex-wrap items-start gap-x-10 gap-y-5">
                  <HeroStat value={data.totalMembers} label="Members" />
                  <HeroStat value={data.active30} label="Active · 30d" />
                  <HeroStat value={attention} label="Needs a look" tone="amber" />
                </div>
                <FlareLine className="mb-4 mt-6 max-w-[420px] opacity-60" />
                <div className="flex flex-wrap items-center gap-2">
                  {data.openSupportReports ? (
                    <Button size="sm" asChild>
                      <Link href="/admin/support">
                        Open support
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  {data.openReports ? (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href="/admin/reports">Review reports</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant={attention ? "secondary" : "default"} asChild>
                    <Link href="/admin/invites">
                      <UserPlus className="size-3.5" />
                      Invite
                    </Link>
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href="/admin/analytics">Analytics</Link>
                  </Button>
                  <MemberJump />
                </div>
              </div>
              <div className="flex items-center justify-center md:pr-4">
                <div className="relative flex size-36 items-center justify-center rounded-full border border-ice/20 bg-bg-0/25 shadow-[0_0_60px_-20px_rgba(127,180,255,.5)] backdrop-blur-sm">
                  <div className="absolute inset-3 rounded-full border border-dashed border-white/15" />
                  <div className="text-center">
                    <p className="font-data text-4xl tabular-nums text-text-hi">{activeRate}%</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[.15em] text-text-lo">
                      30-day active
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Members"
              value={data.totalMembers}
              detail={`${data.signupsMonth} joined this month`}
              icon={Users}
              href="/admin/users"
            />
            <StatTile
              label="New this week"
              value={data.signupsWeek}
              detail="Fresh accounts"
              icon={UserPlus}
              tone="ok"
              href="/admin/invites"
            />
            <StatTile
              label="Open support"
              value={data.openSupportReports}
              detail={data.openSupportReports ? "Awaiting a response" : "Queue is clear"}
              icon={LifeBuoy}
              tone={data.openSupportReports ? "amber" : "ok"}
              href="/admin/support"
            />
            <StatTile
              label="Storage in use"
              value={bytes(data.totalStorageBytes)}
              detail={
                data.suspendedMembers
                  ? `${data.suspendedMembers} suspended`
                  : "Bounces and track assets"
              }
              icon={HardDrive}
              tone="violet"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
            <UsageChart
              title="Member growth"
              detail="New accounts created each day"
              data={data.signups.slice(-30).map((day) => ({ date: day.date, value: day.count }))}
              tone="ice"
            />
            <section className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-mono">Membership</p>
                  <p className="mt-2 text-xs text-text-lo">Engagement and access at a glance</p>
                </div>
                <Users className="size-5 text-ice" />
              </div>
              <div className="mt-6 space-y-5">
                <Progress label="Active in 7 days" value={data.active7} total={data.totalMembers} />
                <Progress
                  label="Active in 30 days"
                  value={data.active30}
                  total={data.totalMembers}
                  tone="ok"
                />
                <Progress
                  label="Outstanding invites"
                  value={data.outstandingInvites}
                  total={Math.max(1, data.totalMembers + data.outstandingInvites)}
                  tone="amber"
                />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link
                  href="/admin/users"
                  className="well lift p-3 transition-colors hover:border-ice/25"
                >
                  <Users className="size-4 text-ice" />
                  <p className="mt-2 text-xs text-text-hi">Manage members</p>
                </Link>
                <Link
                  href="/admin/invites"
                  className="well lift p-3 transition-colors hover:border-amber/25"
                >
                  <UserPlus className="size-4 text-amber" />
                  <p className="mt-2 text-xs text-text-hi">Send invites</p>
                </Link>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <QueueCard
              href="/admin/support"
              icon={LifeBuoy}
              tone="amber"
              title="Support queue"
              empty="Queue is clear"
              count={data.openSupportReports}
            >
              {data.recentSupport.map((ticket) => (
                <QueueRow
                  key={ticket.id}
                  href="/admin/support"
                  eyebrow={ticket.category}
                  title={ticket.subject}
                  meta={`${ticket.email ?? "Member"} · ${timeAgo(ticket.last_message_at ?? ticket.created_at)}`}
                />
              ))}
            </QueueCard>
            <QueueCard
              href="/admin/reports"
              icon={ShieldAlert}
              tone="warn"
              title="Moderation"
              empty="No open reports"
              count={data.openReports}
            >
              {data.recentReports.map((report) => (
                <QueueRow
                  key={report.id}
                  href="/admin/reports"
                  eyebrow={report.target_type.replace("_", " ")}
                  title={report.reason}
                  meta={timeAgo(report.created_at)}
                />
              ))}
            </QueueCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(19rem,.8fr)_minmax(0,1.2fr)]">
            <SystemHealthCard />
            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-mono">Recent admin actions</p>
                  <p className="mt-2 text-xs text-text-lo">Privileged changes, newest first</p>
                </div>
                <Link
                  href="/admin/audit"
                  className="inline-flex items-center gap-1.5 text-xs text-ice hover:underline"
                >
                  Full log
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              {data.recentAudit.length === 0 ? (
                <p className="mt-6 text-sm text-text-lo">No admin actions yet.</p>
              ) : (
                <ul className="mt-5 divide-y divide-line">
                  {data.recentAudit.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function QueueCard({
  href,
  icon: Icon,
  tone,
  title,
  empty,
  count,
  children,
}: {
  href: string;
  icon: typeof LifeBuoy;
  tone: "amber" | "warn";
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "warn"
      ? "border-warn/20 bg-warn/10 text-warn"
      : "border-amber/20 bg-amber/10 text-amber";
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className={cn("flex size-9 items-center justify-center rounded-full border", toneClass)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-hi">{title}</p>
          <p className="mt-0.5 text-xs text-text-lo">
            {count} {count === 1 ? "item" : "items"}
          </p>
        </div>
        <Link href={href} className="inline-flex items-center gap-1.5 text-xs text-ice hover:underline">
          Open
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {count === 0 ? (
        <p className="px-5 py-8 text-sm text-text-lo">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">{children}</ul>
      )}
    </section>
  );
}

function QueueRow({
  href,
  eyebrow,
  title,
  meta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <li>
      <Link href={href} className="block px-5 py-3 transition-colors hover:bg-bg-2/40">
        <p className="label-mono text-[11px]">{eyebrow}</p>
        <p className="mt-1 truncate text-sm text-text-hi">{title}</p>
        <p className="mt-1 text-[11px] text-text-lo">{meta}</p>
      </Link>
    </li>
  );
}

function AuditRow({ entry }: { entry: AdminOverviewAudit }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <p className="min-w-0 truncate text-sm text-text-hi">
        {entry.action.replaceAll(".", " ")}
        <span className="ml-2 text-xs text-text-lo">{entry.target_type}</span>
      </p>
      <p className="shrink-0 text-[11px] tabular-nums text-text-lo">{timeAgo(entry.created_at)}</p>
    </li>
  );
}
