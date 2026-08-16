"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ensureArtistTeamRoom, fetchTeamBrief, markTeamBriefSeen, saveTeamBrief } from "@/lib/api/team-operations";
import { errorMessage } from "@/lib/utils";

export function TeamBriefPanel({ artistId, artistName, isOwner }: { artistId: string; artistName: string; isOwner: boolean }) {
  const query = useQuery({ queryKey: ["team-operations", "brief", artistId], queryFn: () => fetchTeamBrief(artistId) });
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [welcome, setWelcome] = React.useState("");
  const [norms, setNorms] = React.useState("");
  const [timezone, setTimezone] = React.useState("");
  const [rhythm, setRhythm] = React.useState("");
  const brief = query.data?.brief;

  React.useEffect(() => {
    if (!brief) return;
    setWelcome(brief.welcome_note ?? ""); setNorms(brief.working_norms ?? "");
    setTimezone(brief.timezone ?? ""); setRhythm(brief.working_rhythm ?? "");
    if (!isOwner && brief.brief_version) void markTeamBriefSeen(artistId, brief.brief_version);
  }, [artistId, brief, isOwner]);

  const save = useMutation({
    mutationFn: () => saveTeamBrief(artistId, {
      welcome_note: welcome.trim() || null, working_norms: norms.trim() || null,
      timezone: timezone.trim() || null, working_rhythm: rhythm.trim() || null,
    }),
    onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ["team-operations", "brief", artistId] }); toast("Team Brief updated.", "ok"); },
    onError: (error) => toast(errorMessage(error, "Couldn’t update the Team Brief.")),
  });
  const room = useMutation({
    mutationFn: () => ensureArtistTeamRoom(artistId),
    onSuccess: (id) => router.push(`/messages?c=${id}`),
    onError: (error) => toast(errorMessage(error, "Couldn’t open the team room.")),
  });

  if (query.isLoading) return <div className="h-48 animate-pulse rounded-panel bg-bg-2/40" />;
  if (query.isError) return <div className="panel-quiet p-4 text-sm text-warn">The Team Brief isn’t available yet.</div>;

  return (
    <section className="space-y-4" aria-labelledby="team-brief-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p id="team-brief-title" className="label-mono">{artistName} · Team Brief</p><p className="mt-1 text-sm text-text-lo">What the team needs to know right now.</p></div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={room.isPending} onClick={() => room.mutate()}><MessageCircle className="size-3.5" /> Team room</Button>
          {isOwner && !editing ? <Button type="button" size="sm" onClick={() => setEditing(true)}>Edit brief</Button> : null}
        </div>
      </div>
      {editing ? (
        <div className="panel space-y-4 p-4">
          <div><label htmlFor="brief-welcome" className="label-mono mb-1 block">Welcome note</label><Textarea id="brief-welcome" value={welcome} maxLength={4000} onChange={(e) => setWelcome(e.target.value)} placeholder="What should a new teammate understand first?" /></div>
          <div><label htmlFor="brief-norms" className="label-mono mb-1 block">How we work</label><Textarea id="brief-norms" value={norms} maxLength={6000} onChange={(e) => setNorms(e.target.value)} placeholder="Communication, decisions, and handoff expectations." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="brief-timezone" className="label-mono mb-1 block">Timezone</label><Input id="brief-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Denver" /></div>
            <div><label htmlFor="brief-rhythm" className="label-mono mb-1 block">Working rhythm</label><Input id="brief-rhythm" value={rhythm} maxLength={1000} onChange={(e) => setRhythm(e.target.value)} placeholder="Weekly check-in on Mondays" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save brief"}</Button></div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <BriefCard title="Current signal" body={brief?.welcome_note || "No welcome note yet."} />
          <BriefCard title="How we work" body={brief?.working_norms || "No working norms yet."} />
          <BriefCard title="Working rhythm" body={[brief?.working_rhythm, brief?.timezone].filter(Boolean).join(" · ") || "No rhythm set yet."} />
          <div className="panel-quiet p-4"><p className="label-mono">Links & references</p>{(query.data?.links ?? []).length ? <ul className="mt-3 space-y-2">{query.data!.links.map((link) => <li key={link.id}><a className="text-sm text-ice hover:underline" href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}</ul> : <p className="mt-3 text-sm text-text-lo">No shared links yet.</p>}</div>
        </div>
      )}
    </section>
  );
}

function BriefCard({ title, body }: { title: string; body: string }) {
  return <div className="panel-quiet p-4"><p className="label-mono">{title}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-hi">{body}</p></div>;
}
