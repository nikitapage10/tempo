"use client";

import * as React from "react";
import { CalendarDays, HeartCrack, MessageCircle, Music2, Radio, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type Tab = "feed" | "members" | "events" | "about";

const MEMBERS = ["PRESIDENT", "My Chemical Romance", "Evanescence", "Linkin Park", "Bring Me The Horizon", "Spiritbox"];
const POSTS = [
  { author: "My Chemical Romance", body: "Important community question: which song made you dramatically stare out of a car window before you were old enough to drive?", reply: "PRESIDENT: Please submit answers in descending order of unnecessary rain." },
  { author: "Spiritbox", body: "Serious thread: what is one arrangement choice that made a heavy song feel heavier without adding another guitar layer?", reply: "Linkin Park: Contrast. Give the impact somewhere quiet to arrive from." },
  { author: "Evanescence", body: "Tonight’s listening room is about piano intros, impossible feelings, and resisting the urge to master everything louder.", reply: "Bring Me The Horizon: We can promise two of those three things." },
];

export function DemoScenesView() {
  const [tab, setTab] = React.useState<Tab>("feed");
  const tabs: { id: Tab; label: string }[] = [
    { id: "feed", label: "Feed" },
    { id: "members", label: "Members" },
    { id: "events", label: "Events" },
    { id: "about", label: "About" },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Scenes" subtitle="Rooms for the people you make music with." />
      <div className="panel-quiet flex items-start gap-3 px-4 py-3 text-sm text-text-lo">
        <Radio className="mt-0.5 size-4 shrink-0 text-ice" />
        <p>This is a read-only demo Scene. Its artists and conversations show how a community can feel without creating fake memberships or changing the live network.</p>
      </div>

      <section className="panel overflow-hidden">
        <div className="relative min-h-64 overflow-hidden bg-[radial-gradient(circle_at_18%_15%,rgb(239_68_68_/_0.22),transparent_38%),radial-gradient(circle_at_82%_75%,rgb(139_92_246_/_0.2),transparent_42%),linear-gradient(135deg,#17131d,#09090c)] p-6 sm:p-8">
          <div className="scene-hero-grain absolute inset-0 opacity-[0.08]" />
          <div className="relative flex min-h-48 items-end">
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/35 text-rose-300 shadow-e2 backdrop-blur"><HeartCrack className="size-7" /></span>
              <div>
                <p className="label-mono text-white/55">Demo Scene · Emo & old metal</p>
                <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">It’s Not Just a Phase</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">For big choruses, old band shirts, honest feedback, and everyone who still knows exactly where they were when the bridge hit.</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-white/50"><Users className="size-3.5" /> 2,003 demo members · Worldwide</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-line px-4 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("border-b-2 px-3 py-2 text-xs transition-colors", tab === item.id ? "border-ice text-ice" : "border-transparent text-text-lo hover:text-text-hi")}>{item.label}</button>)}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === "feed" ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="space-y-3">{POSTS.map((post) => <article key={post.author} className="well rounded-card p-4"><div className="flex items-center gap-2.5"><ArtistMark emblemUrl={null} paletteId="noir" name={post.author} size={26} className="size-7" /><p className="text-sm font-medium text-text-hi">{post.author}</p></div><p className="mt-3 text-sm leading-6 text-text-mid">{post.body}</p><p className="mt-3 border-l-2 border-ice/25 pl-3 text-xs leading-5 text-text-lo">{post.reply}</p></article>)}</div><aside className="panel-quiet h-fit p-4"><p className="label-mono">Scene pulse</p><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-text-lo">Listening now</dt><dd className="mt-1 text-text-hi">48 members</dd></div><div><dt className="text-text-lo">Most active topic</dt><dd className="mt-1 text-text-hi">Songs that raised us</dd></div><div><dt className="text-text-lo">Next gathering</dt><dd className="mt-1 text-text-hi">Thursday · 8 PM</dd></div></dl></aside></div> : null}
          {tab === "members" ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MEMBERS.map((name, index) => <div key={name} className="well flex items-center gap-3 rounded-card p-3"><ArtistMark emblemUrl={null} paletteId={index % 2 ? "spectra" : "noir"} name={name} size={32} className="size-9" /><div><p className="text-sm text-text-hi">{name}</p><p className="text-xs text-text-lo">Demo member</p></div></div>)}</div> : null}
          {tab === "events" ? <div className="grid gap-3 sm:grid-cols-2"><DemoEvent title="Sad Songs & Loud Guitars" date="Thursday · 8:00 PM" copy="A listening room: one song that formed you, one song you are making now." /><DemoEvent title="The 2000s Eyeliner Symposium" date="Saturday · 6:30 PM" copy="Half serious craft talk, half defense of dramatic music-video weather." /></div> : null}
          {tab === "about" ? <div className="max-w-3xl"><p className="label-mono">About this Scene</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-mid">It’s Not Just a Phase is a cross-generational room for emo, alternative rock, post-hardcore, nu metal and the darker corners of heavy music. Members trade thoughtful feedback, revisit the records that shaped them, and talk honestly about how theatrical music can still carry precise craft.\n\nThe joke is in the name; the work is taken seriously. Give specific feedback, never confuse cynicism with taste, and make room for the song that somebody else needed more than you did.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">Emo</span><span className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">Alternative metal</span><span className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">Post-hardcore</span></div></div> : null}
        </div>
      </section>
    </div>
  );
}

function DemoEvent({ title, date, copy }: { title: string; date: string; copy: string }) {
  return <article className="well rounded-card p-4"><span className="flex size-8 items-center justify-center rounded-input border border-line bg-bg-2 text-amber"><CalendarDays className="size-4" /></span><h2 className="mt-4 font-display text-lg font-semibold text-text-hi">{title}</h2><p className="mt-1 font-mono text-[11px] text-ice">{date}</p><p className="mt-3 text-sm leading-6 text-text-lo">{copy}</p><div className="mt-4 flex items-center gap-1.5 text-xs text-text-lo"><MessageCircle className="size-3.5" /><Music2 className="size-3.5" /> Demo gathering</div></article>;
}
