"use client";

import * as React from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useGuestLinkMutations, useGuestLinks } from "@/hooks/use-guest-links";
import { guestLinkUrl } from "@/lib/api/guest-links";
import { addDays, formatShortDate } from "@/lib/format";
import type { GuestReviewLink, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

type GuestLinksPanelProps = {
  trackId: string;
  versions: Version[];
  selectedVersionId: string | null;
};

type ExpiryOption = "7" | "14" | "30" | "never";

function linkStatus(link: GuestReviewLink): "active" | "expired" | "revoked" {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

export function GuestLinksPanel({
  trackId,
  versions,
  selectedVersionId,
}: GuestLinksPanelProps) {
  const { data: links = [], isLoading } = useGuestLinks(trackId);
  const { create, revoke } = useGuestLinkMutations(trackId);
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [versionId, setVersionId] = React.useState(selectedVersionId ?? "");
  const [label, setLabel] = React.useState("");
  const [expiry, setExpiry] = React.useState<ExpiryOption>("14");
  const [allowComments, setAllowComments] = React.useState(true);
  const [allowDownload, setAllowDownload] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [freshLink, setFreshLink] = React.useState<{ url: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && !versionId && selectedVersionId) setVersionId(selectedVersionId);
  }, [open, versionId, selectedVersionId]);

  if (!versions.length) {
    return (
      <section className="rounded-card border border-dashed border-line bg-bg-1/60 p-4">
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Guest review links
        </h2>
        <p className="text-sm text-text-lo">
          Upload a bounce first — a guest link points at one fixed version.
        </p>
      </section>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!versionId) return;
    setBusy(true);
    try {
      const expiresAt =
        expiry === "never" ? null : addDays(new Date(), Number(expiry)).toISOString();
      const { rawToken } = await create.mutateAsync({
        versionId,
        label: label.trim() || null,
        expiresAt,
        allowComments,
        allowDownload,
      });
      setFreshLink({ url: guestLinkUrl(rawToken) });
      setCopied(false);
      setLabel("");
      toast("Guest link created", "ok");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t create the guest link — try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyFreshLink() {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink.url);
      setCopied(true);
    } catch {
      toast("Couldn’t copy — select and copy the link manually.");
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Guest review links
        </h2>
        {!open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Create link
          </Button>
        ) : null}
      </div>

      {open ? (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-card border border-line bg-bg-2/50 p-3"
        >
          <div>
            <Label htmlFor="guest-link-version">Version</Label>
            <select
              id="guest-link-version"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_no}
                  {v.is_current ? " · current" : ""}
                  {v.label ? ` — ${v.label}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="guest-link-label">Label (optional)</Label>
            <Input
              id="guest-link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="For the mix engineer…"
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="guest-link-expiry">Expires</Label>
            <select
              id="guest-link-expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as ExpiryOption)}
              className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <option value="7">7 days</option>
              <option value="14">14 days (default)</option>
              <option value="30">30 days</option>
              <option value="never">Never</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-text-lo">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
              />
              Allow comments
            </label>
            <label className="flex items-center gap-2 text-xs text-text-lo">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
              Allow download
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !versionId}>
              {busy ? "Creating…" : "Create link"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setFreshLink(null);
              }}
            >
              Close
            </Button>
          </div>
        </form>
      ) : null}

      {freshLink ? (
        <div className="mb-4 rounded-card border border-ice/40 bg-ice/5 p-3">
          <p className="text-xs text-text-lo">
            Copy this link now — TEMPO only shows it once.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-input border border-line bg-bg-2 px-2 py-1.5 font-mono text-xs text-text-hi">
              {freshLink.url}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyFreshLink()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] text-text-lo hover:text-text-hi"
            onClick={() => setFreshLink(null)}
          >
            Done
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {isLoading ? (
          <li className="h-12 animate-pulse rounded-card bg-bg-2" />
        ) : links.length === 0 ? (
          <li className="py-3 text-center text-sm text-text-lo">
            No guest links yet. Create one to get outside feedback without an account.
          </li>
        ) : (
          links.map((link) => {
            const status = linkStatus(link);
            const version = versions.find((v) => v.id === link.version_id);
            return (
              <li
                key={link.id}
                className="rounded-card border border-line bg-bg-2/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="size-3.5 text-text-lo" />
                      <span className="truncate text-sm text-text-hi">
                        {link.label || (version ? `v${version.version_no}` : "Guest link")}
                      </span>
                      <StatusChip status={status} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-text-lo">
                      {version ? `v${version.version_no} · ` : ""}
                      created {formatShortDate(link.created_at)}
                      {link.expires_at
                        ? ` · expires ${formatShortDate(link.expires_at)}`
                        : " · no expiry"}
                      {link.last_accessed_at
                        ? ` · last viewed ${formatShortDate(link.last_accessed_at)}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-lo">
                      {link.allow_comments ? "Comments on" : "Comments off"} ·{" "}
                      {link.allow_download ? "Download on" : "Download off"}
                    </p>
                  </div>
                  {status === "active" ? (
                    confirmRevokeId === link.id ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px]">
                        <span className="text-warn">Revoke?</span>
                        <button
                          type="button"
                          className="text-warn hover:underline"
                          onClick={async () => {
                            try {
                              await revoke.mutateAsync(link.id);
                              setConfirmRevokeId(null);
                            } catch (err) {
                              toast(
                                err instanceof Error
                                  ? err.message
                                  : "Couldn’t revoke that link."
                              );
                            }
                          }}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className="text-text-lo hover:text-text-hi"
                          onClick={() => setConfirmRevokeId(null)}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 rounded-input px-2 py-1 text-[11px] text-text-lo hover:bg-bg-1 hover:text-warn"
                        onClick={() => setConfirmRevokeId(link.id)}
                      >
                        Revoke
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function StatusChip({ status }: { status: "active" | "expired" | "revoked" }) {
  return (
    <span
      className={cn(
        "rounded-chip px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        status === "active" && "bg-ok/15 text-ok",
        status === "expired" && "bg-text-lo/15 text-text-lo",
        status === "revoked" && "bg-warn/15 text-warn"
      )}
    >
      {status}
    </span>
  );
}
