"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Import, Sparkles } from "lucide-react";
import { ArtistsManager } from "@/components/artists/artists-manager";
import { SpacesManager } from "@/components/spaces/spaces-manager";
import { AccountPanel } from "@/components/settings/account-panel";
import { CatalogBackupPanel } from "@/components/settings/catalog-backup-panel";
import { NotificationsPanel } from "@/components/settings/notifications-panel";
import { PulsePreferencesPanel } from "@/components/settings/pulse-preferences-panel";
import { FlareLine } from "@/components/flare-line";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "studio", label: "Studio", hint: "Artists & spaces" },
  { id: "catalog", label: "Catalog", hint: "Import & backups" },
  { id: "notifications", label: "Notifications", hint: "Full activity" },
  { id: "account", label: "Account", hint: "Sign-in & privacy" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null | undefined): value is TabId {
  return TABS.some((t) => t.id === value);
}

function SettingsPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label-mono text-ice">{eyebrow}</p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-text-hi">
          {title}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-text-lo">
          {description}
        </p>
        <FlareLine className="mt-4 max-w-md opacity-40" />
      </div>
      {children}
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  body,
  cta,
  secondaryHref,
  secondaryCta,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  secondaryHref?: string;
  secondaryCta?: string;
}) {
  return (
    <div className="panel-quiet flex h-full flex-col p-5">
      <div className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
        <Icon className="size-4 text-ice" />
      </div>
      <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
        {title}
      </p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-text-lo">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={href}>{cta}</Link>
        </Button>
        {secondaryHref && secondaryCta ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={secondaryHref}>{secondaryCta}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={<div className="panel h-64 w-full animate-pulse" />}
    >
      <SettingsPageInner />
    </React.Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const active: TabId = isTabId(paramTab) ? paramTab : "studio";

  React.useEffect(() => {
    if (active !== "studio") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash !== "artists" && hash !== "spaces") return;
    const node = document.getElementById(hash);
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [active]);

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "studio") next.delete("tab");
    else next.set("tab", id);
    const qs = next.toString();
    router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false });
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Settings"
        subtitle="Artists, spaces, notifications, catalog backups, and your account — stage editing still lives on the board."
      />

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
        <nav
          aria-label="Settings tabs"
          className="mb-6 lg:sticky lg:top-20 lg:mb-0 lg:self-start"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {TABS.map((item) => {
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`settings-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`settings-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(item.id)}
                  className={cn(
                    "shrink-0 rounded-input border px-3 py-2 text-left transition-colors duration-hover",
                    selected
                      ? "border-ice/30 bg-ice/10 text-text-hi"
                      : "border-transparent text-text-lo hover:border-line hover:bg-bg-2/60 hover:text-text-hi",
                  )}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 hidden text-xs text-text-lo lg:block">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="label-mono mt-4 hidden px-1 lg:block">v{APP_VERSION}</p>
        </nav>

        <div className="pb-10">
          {active === "studio" ? (
            <div
              role="tabpanel"
              id="settings-panel-studio"
              aria-labelledby="settings-tab-studio"
            >
              <SettingsPanel
                eyebrow="Studio"
                title="Who you’re working as"
                description="Artists and spaces shape the rail, board, and everything scoped to the name you release under."
              >
                <div className="space-y-4">
                  <ArtistsManager />
                  <SpacesManager />
                  <ActionTile
                    href="/origin?revisit=1"
                    secondaryHref="/origin?replay=1"
                    icon={Sparkles}
                    title="Artist Origin"
                    body="The story TEMPO drafted from your introduction — promise, compass, and the chapter you’re in. Revisit or rewrite anytime."
                    cta="Open Artist Origin"
                    secondaryCta="Replay introduction"
                  />
                </div>
              </SettingsPanel>
            </div>
          ) : null}

          {active === "catalog" ? (
            <div
              role="tabpanel"
              id="settings-panel-catalog"
              aria-labelledby="settings-tab-catalog"
            >
              <SettingsPanel
                eyebrow="Catalog"
                title="Bring music in & keep it safe"
                description="Import messy evidence into a reviewable plan, or export and restore the text side of your catalog."
              >
                <div className="space-y-4">
                  <div className="panel-quiet flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
                        <Import className="size-4 text-ice" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold tracking-tight text-text-hi">
                          Import more music
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-text-lo">
                          Spreadsheet, screenshots, or a voice note — nothing
                          lands until you approve the plan. A TEMPO catalog
                          export restores from Your data below.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" className="shrink-0" asChild>
                      <Link href="/import">Open Import</Link>
                    </Button>
                  </div>
                  <CatalogBackupPanel />
                </div>
              </SettingsPanel>
            </div>
          ) : null}

          {active === "notifications" ? (
            <div
              role="tabpanel"
              id="settings-panel-notifications"
              aria-labelledby="settings-tab-notifications"
              className="space-y-10"
            >
              <SettingsPanel
                eyebrow="Pulse"
                title="Your briefing cadence"
                description="Choose when and how much TEMPO summarizes for you — in-app is always on; email is opt-in."
              >
                <PulsePreferencesPanel />
              </SettingsPanel>

              <SettingsPanel
                eyebrow="Notifications"
                title="Everything that pinged you"
                description="Browse the full feed by area, mark things read, or dismiss what you don’t need. The bell still keeps the latest close."
              >
                <NotificationsPanel />
              </SettingsPanel>
            </div>
          ) : null}

          {active === "account" ? (
            <div
              role="tabpanel"
              id="settings-panel-account"
              aria-labelledby="settings-tab-account"
            >
              <SettingsPanel
                eyebrow="Account"
                title="Sign-in, privacy & this device"
                description="Manage how you log in, where your profile is visible, and whether this account stays around."
              >
                <AccountPanel />
              </SettingsPanel>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
