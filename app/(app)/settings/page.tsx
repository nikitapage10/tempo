"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Import,
  LogOut,
  Sparkles,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ArtistsManager } from "@/components/artists/artists-manager";
import { SpacesManager } from "@/components/spaces/spaces-manager";
import { CatalogBackupPanel } from "@/components/settings/catalog-backup-panel";
import { FlareLine } from "@/components/flare-line";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SupportReportDialog } from "@/components/support/support-report-dialog";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "studio", label: "Studio", hint: "Artists & spaces" },
  { id: "catalog", label: "Catalog", hint: "Import & backups" },
  { id: "account", label: "Account", hint: "Help & sign out" },
] as const;

function SettingsGroup({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
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
    </section>
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
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [active, setActive] = React.useState<string>("studio");

  React.useEffect(() => {
    const nodes = NAV.map((item) => document.getElementById(item.id)).filter(
      (n): n is HTMLElement => !!n,
    );
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Settings"
        subtitle="Artists, spaces, catalog backups, and your account — stage editing still lives on the board."
      />

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
        <nav
          aria-label="Settings sections"
          className="mb-6 lg:sticky lg:top-20 lg:mb-0 lg:self-start"
        >
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActive(item.id)}
                className={cn(
                  "shrink-0 rounded-input border px-3 py-2 transition-colors duration-hover",
                  active === item.id
                    ? "border-ice/30 bg-ice/10 text-text-hi"
                    : "border-transparent text-text-lo hover:border-line hover:bg-bg-2/60 hover:text-text-hi",
                )}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 hidden text-[11px] text-text-lo lg:block">
                  {item.hint}
                </span>
              </a>
            ))}
          </div>
          <p className="label-mono mt-4 hidden px-1 lg:block">v{APP_VERSION}</p>
        </nav>

        <div className="space-y-12 pb-10">
          <SettingsGroup
            id="studio"
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
          </SettingsGroup>

          <SettingsGroup
            id="catalog"
            eyebrow="Catalog"
            title="Bring music in & keep it safe"
            description="Import messy evidence into a reviewable plan, or export and restore the text side of your catalog."
          >
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
                    Spreadsheet, screenshots, or a voice note — nothing lands
                    until you approve the plan. A TEMPO catalog export restores
                    from Your data below.
                  </p>
                </div>
              </div>
              <Button variant="secondary" className="shrink-0" asChild>
                <Link href="/import">Open Import</Link>
              </Button>
            </div>
            <CatalogBackupPanel />
          </SettingsGroup>

          <SettingsGroup
            id="account"
            eyebrow="Account"
            title="Help & this device"
            description="Reach the TEMPO operator, or sign out on this browser."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel-quiet p-5">
                <div className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
                  <HelpCircle className="size-4 text-ice" />
                </div>
                <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
                  Help &amp; support
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-lo">
                  Report a bug, ask for help, or share feedback.
                </p>
                <div className="mt-4">
                  <SupportReportDialog compact />
                </div>
              </div>

              <div className="panel-quiet p-5">
                <div className="flex size-9 items-center justify-center rounded-full border border-line bg-bg-2">
                  <UserRound className="size-4 text-text-lo" />
                </div>
                <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
                  This device
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-lo">
                  Sign out of TEMPO on this browser. Your catalog stays in the
                  cloud.
                </p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="mr-1.5 size-3.5" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </div>
          </SettingsGroup>
        </div>
      </div>
    </div>
  );
}
