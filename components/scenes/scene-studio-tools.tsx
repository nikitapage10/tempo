"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Award, BookOpen, Copy, Eye, FileText, Images, Link2, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useMyScenePersona, useSceneBadges, useScenePersonas, useSceneSections, useSceneV2Mutations } from "@/hooks/use-scene-v2";
import { createSceneLibraryCollection, createSceneLibraryItem, createSceneShowcaseItem, upsertScenePage } from "@/lib/api/scene-library";
import { awardSceneBadge, createSceneBadge } from "@/lib/api/scene-recognition";
import { createSceneInviteLink } from "@/lib/api/scene-invites";
import { updateSceneSection } from "@/lib/api/scene-sections";
import type { Scene } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="input w-full" />; }

export function SceneStudioContent({ scene }: { scene: Scene }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: sections = [] } = useSceneSections(scene.id);
  const { data: persona } = useMyScenePersona(scene.id);
  const [sectionId, setSectionId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const selected = sections.find((section) => section.id === sectionId) ?? sections.find((section) => ["library","page","showcase"].includes(section.type));
  React.useEffect(() => { if (!sectionId && selected) setSectionId(selected.id); }, [sectionId, selected]);
  const contentSections = sections.filter((section) => ["library","page","showcase"].includes(section.type));
  async function create() {
    if (!selected || !title.trim()) return;
    setBusy(true);
    try {
      if (selected.type === "library") await createSceneLibraryItem({ scene_id: scene.id, section_id: selected.id, collection_id: null, created_by_persona_id: persona?.id ?? null, kind: url ? "link" : "article", title, description: description || null, body: url ? null : description, external_url: url || null, file_url: null, thumbnail_url: null, media_meta: {}, sort_order: 0, scheduled_for: null, published_at: new Date().toISOString() });
      if (selected.type === "page") await upsertScenePage({ sceneId: scene.id, sectionId: selected.id, publish: true, blocks: [{ id: crypto.randomUUID(), type: "heading", data: { text: title } }, { id: crypto.randomUUID(), type: "paragraph", data: { text: description } }] });
      if (selected.type === "showcase") { if (!persona) throw new Error("Create your Scene identity first."); await createSceneShowcaseItem({ sceneId: scene.id, sectionId: selected.id, personaId: persona.id, title, description, externalUrl: url, visibility: selected.public_visible ? "public" : "members" }); }
      setTitle(""); setDescription(""); setUrl(""); void qc.invalidateQueries({ queryKey: ["scene-library"] }); void qc.invalidateQueries({ queryKey: ["scene-page"] }); void qc.invalidateQueries({ queryKey: ["scene-showcase"] }); toast("Content published.", "ok");
    } catch (error) { toast(errorMessage(error, "Couldn't publish that content.")); } finally { setBusy(false); }
  }
  async function togglePublic() { if (!selected) return; try { await updateSceneSection(selected.id, { public_visible: !selected.public_visible }); void qc.invalidateQueries({ queryKey: ["scene-sections", scene.id] }); toast(selected.public_visible ? "Removed from the public page." : "Added to the public page.", "ok"); } catch (error) { toast(errorMessage(error, "Couldn't change public visibility.")); } }
  if (!contentSections.length) return <div className="panel p-8 text-center"><BookOpen className="mx-auto size-5 text-amber" /><h2 className="mt-4 font-display text-xl font-semibold">Add a content section first</h2><p className="mt-2 text-sm text-text-lo">Create a Library, Page, or Showcase under Structure, then return here to publish into it.</p></div>;
  const Icon = selected?.type === "page" ? FileText : selected?.type === "showcase" ? Images : BookOpen;
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label-mono">Publishing desk</p><h2 className="mt-1 font-display text-xl font-semibold">Content</h2></div><Button variant="secondary" size="sm" onClick={() => void togglePublic()}><Eye className="size-3.5" />{selected?.public_visible ? "Public" : "Members only"}</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{contentSections.map((section) => <button key={section.id} type="button" onClick={() => setSectionId(section.id)} className={`rounded-panel border p-4 text-left ${selected?.id === section.id ? "border-ice/40 bg-ice/5" : "border-line bg-bg-1"}`}><p className="text-xs capitalize text-text-lo">{section.type}</p><p className="mt-2 font-display font-semibold text-text-hi">{section.name}</p></button>)}</div></div><div className="panel-quiet p-5"><Icon className="size-5 text-ice" /><p className="label-mono mt-4">Publish to {selected?.name}</p><div className="mt-4 space-y-3"><Input value={title} onChange={setTitle} placeholder={selected?.type === "page" ? "Page heading" : "Title"} /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={selected?.type === "page" ? "Write the page…" : "Description or notes"} rows={5} className="input w-full resize-y" />{selected?.type !== "page" ? <Input value={url} onChange={setUrl} placeholder="Optional link" /> : null}<Button className="w-full" onClick={() => void create()} disabled={!title.trim() || busy}><Send className="size-4" />Publish</Button></div></div></div>;
}

export function SceneStudioRecognition({ scene }: { scene: Scene }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: badges = [] } = useSceneBadges(scene.id); const { data: personas = [] } = useScenePersonas(scene.id);
  const [name,setName]=React.useState(""); const [icon,setIcon]=React.useState("✨"); const [points,setPoints]=React.useState("25"); const [badgeId,setBadgeId]=React.useState(""); const [personaId,setPersonaId]=React.useState("");
  async function addBadge(){try{await createSceneBadge({sceneId:scene.id,name,icon,points:Number(points)||0});setName("");void qc.invalidateQueries({queryKey:["scene-badges",scene.id]});toast("Recognition created.","ok");}catch(error){toast(errorMessage(error,"Couldn't create that recognition."));}}
  async function award(){if(!badgeId||!personaId)return;try{await awardSceneBadge({badgeId,personaId});toast("Recognition awarded.","ok");}catch(error){toast(errorMessage(error,"Couldn't award that recognition."));}}
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="panel p-5"><p className="label-mono">Culture made visible</p><h2 className="mt-1 font-display text-xl font-semibold">Recognition</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{badges.map((badge)=><div key={badge.id} className="rounded-panel border border-line bg-bg-1 p-4"><span className="text-2xl">{badge.icon}</span><p className="mt-3 font-display font-semibold">{badge.name}</p><p className="mt-1 text-xs text-text-lo">{badge.description || `${badge.points} contribution points`}</p></div>)}</div><div className="mt-5 grid gap-2 sm:grid-cols-[80px_1fr_90px_auto]"><Input value={icon} onChange={setIcon} placeholder="Icon"/><Input value={name} onChange={setName} placeholder="Recognition name"/><Input value={points} onChange={setPoints} placeholder="Points" type="number"/><Button onClick={()=>void addBadge()} disabled={!name.trim()}><Plus className="size-4"/>Add</Button></div></div><div className="panel-quiet p-5"><Award className="size-5 text-amber"/><p className="label-mono mt-4">Award recognition</p><select className="input mt-4 w-full" value={badgeId} onChange={(event)=>setBadgeId(event.target.value)}><option value="">Choose recognition</option>{badges.map((badge)=><option key={badge.id} value={badge.id}>{badge.icon} {badge.name}</option>)}</select><select className="input mt-3 w-full" value={personaId} onChange={(event)=>setPersonaId(event.target.value)}><option value="">Choose member</option>{personas.map((member)=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select><Button className="mt-3 w-full" onClick={()=>void award()} disabled={!badgeId||!personaId}><Sparkles className="size-4"/>Award</Button></div></div>;
}

export function SceneStudioInvites({ scene }: { scene: Scene }) {
  const { toast }=useToast(); const [label,setLabel]=React.useState(""); const [uses,setUses]=React.useState("10"); const [token,setToken]=React.useState(""); const [busy,setBusy]=React.useState(false);
  const inviteUrl=token&&typeof window!=="undefined"?`${window.location.origin}/scene/invite/${token}`:"";
  async function create(){setBusy(true);try{setToken(await createSceneInviteLink({sceneId:scene.id,label,maxUses:Number(uses)||1,expiresInDays:14}));toast("Invitation link created.","ok");}catch(error){toast(errorMessage(error,"Couldn't create that invitation."));}finally{setBusy(false);}}
  return <div className="mx-auto max-w-2xl panel p-6"><Link2 className="size-5 text-ice"/><h2 className="mt-4 font-display text-2xl font-semibold">Invite people into the room</h2><p className="mt-2 text-sm text-text-lo">Create a limited link that works for two weeks. It can bring someone into an invite-only Scene without exposing anything else.</p><div className="mt-6 grid gap-3 sm:grid-cols-[1fr_110px_auto]"><Input value={label} onChange={setLabel} placeholder="Cohort, hosts, close collaborators…"/><Input value={uses} onChange={setUses} placeholder="Uses" type="number"/><Button onClick={()=>void create()} disabled={busy}>Create link</Button></div>{inviteUrl?<div className="mt-5 rounded-input border border-ice/20 bg-ice/5 p-3"><p className="break-all text-xs text-text-hi">{inviteUrl}</p><Button variant="ghost" size="sm" className="mt-2" onClick={async()=>{await navigator.clipboard.writeText(inviteUrl);toast("Link copied.","ok");}}><Copy className="size-3.5"/>Copy invitation</Button></div>:null}</div>;
}
