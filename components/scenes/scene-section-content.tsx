"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, FileText, Headphones, Play, Sparkles } from "lucide-react";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { SignedImage } from "@/components/ui/signed-image";
import { useSceneLibrary, useScenePage, useSceneShowcase } from "@/hooks/use-scene-v2";
import type { ScenePageBlock, SceneSection } from "@/lib/types";

function LibrarySection({ section }: { section: SceneSection }) {
  const { data, isLoading } = useSceneLibrary(section.id);
  if (isLoading) return <div className="panel h-56 animate-pulse" />;
  const items = data?.items ?? [];
  if (!items.length) return <EmptyShaderPanel title="The shelf is ready" copy="Add replays, guides, templates, links, and files to build this Scene's shared memory." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <a key={item.id} href={item.external_url || item.file_url || "#"} target="_blank" rel="noreferrer" className="group panel-quiet flex min-h-36 flex-col justify-between overflow-hidden p-4 transition hover:border-ice/30">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-input border border-line bg-bg-2 p-2 text-ice"><BookOpen className="size-4" /></span>
            <ArrowUpRight className="size-4 text-text-lo transition group-hover:text-ice" />
          </div>
          <div className="mt-6"><p className="label-mono">{item.kind}</p><h3 className="mt-1 font-display font-semibold text-text-hi">{item.title}</h3>{item.description ? <p className="mt-1 line-clamp-2 text-xs text-text-lo">{item.description}</p> : null}</div>
        </a>
      ))}
    </div>
  );
}
function PageBlock({ block }: { block: ScenePageBlock }) {
  const text = typeof block.data.text === "string" ? block.data.text : "";
  if (block.type === "heading") return <h2 className="font-display text-2xl font-semibold text-text-hi">{text}</h2>;
  if (block.type === "paragraph") return <p className="whitespace-pre-wrap leading-7 text-text-mid">{text}</p>;
  if (block.type === "divider") return <div className="h-px bg-line" />;
  if (block.type === "image" && typeof block.data.url === "string") return <SignedImage path={block.data.url} alt={typeof block.data.alt === "string" ? block.data.alt : ""} className="max-h-[520px] w-full rounded-panel object-cover" />;
  if (block.type === "callout") return <div className="rounded-panel border border-ice/20 bg-ice/5 p-4 text-sm leading-6 text-text-hi">{text}</div>;
  if (block.type === "button" && typeof block.data.url === "string") return <Link href={block.data.url} className="inline-flex w-fit items-center gap-2 rounded-input bg-ice px-4 py-2 text-sm font-medium text-bg-0">{text || "Open"}<ArrowUpRight className="size-4" /></Link>;
  return null;
}

function PageSection({ section }: { section: SceneSection }) {
  const { data: page, isLoading } = useScenePage(section.id);
  if (isLoading) return <div className="panel h-56 animate-pulse" />;
  if (!page?.blocks.length) return <EmptyShaderPanel title="A new page" copy="Managers can compose this page with stories, images, links, and calls to action." />;
  return <article className="panel mx-auto max-w-3xl space-y-6 p-6 sm:p-10">{page.blocks.map((block) => <PageBlock key={block.id} block={block} />)}</article>;
}

function ShowcaseSection({ section }: { section: SceneSection }) {
  const { data: items = [], isLoading } = useSceneShowcase(section.id);
  if (isLoading) return <div className="panel h-56 animate-pulse" />;
  if (!items.length) return <EmptyShaderPanel title="Nothing on stage yet" copy="Members can share work in progress, releases, writing, and creative experiments here." />;
  return <div className="grid gap-4 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="panel overflow-hidden"><div className="relative aspect-video bg-[radial-gradient(circle_at_20%_15%,color-mix(in_srgb,var(--ice)_25%,transparent),transparent_55%),linear-gradient(135deg,var(--bg-2),var(--bg-0))]"><div className="absolute inset-0 grid place-items-center"><span className="rounded-full border border-white/15 bg-black/30 p-4 backdrop-blur"><Play className="size-5 fill-current text-white" /></span></div>{item.featured_at ? <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-chip border border-amber/30 bg-black/40 px-2 py-1 text-[10px] text-amber"><Sparkles className="size-3" />Featured</span> : null}</div><div className="p-4"><h3 className="font-display font-semibold text-text-hi">{item.title}</h3>{item.description ? <p className="mt-1 line-clamp-2 text-sm text-text-lo">{item.description}</p> : null}{item.feedback_prompt ? <p className="mt-3 border-l-2 border-ice/40 pl-3 text-xs text-text-mid">{item.feedback_prompt}</p> : null}</div></article>)}</div>;
}

export function SceneSectionContent({ section }: { section: SceneSection }) {
  if (section.type === "library") return <LibrarySection section={section} />;
  if (section.type === "page") return <PageSection section={section} />;
  if (section.type === "showcase") return <ShowcaseSection section={section} />;
  return null;
}
