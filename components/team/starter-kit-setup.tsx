"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { installStarterKits, previewStarterKits, type StarterKitPreview } from "@/lib/api/team-operations";
import { cn, errorMessage } from "@/lib/utils";

const KITS = [
  ["manager","Manager"],["label","Label / label owner"],["publicist","Publicist"],
  ["tour_manager","Tour manager"],["agent","Agent"],["assistant","Assistant"],["custom","Custom"],
] as const;

export function StarterKitSetup() {
  const [open,setOpen]=React.useState(false);const [selected,setSelected]=React.useState<string[]>([]);
  const [primary,setPrimary]=React.useState("work");const [samples,setSamples]=React.useState(false);
  const [preview,setPreview]=React.useState<StarterKitPreview|null>(null);const {toast}=useToast();
  const previewMutation=useMutation({mutationFn:()=>previewStarterKits(selected,primary,samples),onSuccess:setPreview,onError:(e)=>toast(errorMessage(e,"Couldn’t preview those starter kits."))});
  const install=useMutation({mutationFn:()=>installStarterKits(selected,primary,samples,crypto.randomUUID()),onSuccess:(result)=>{toast(`Added ${result.added}; ${result.already_present} already present.`,"ok");setOpen(false);setPreview(null);},onError:(e)=>toast(errorMessage(e,"Couldn’t install those starter kits."))});
  if(!open)return <div className="panel-quiet flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm text-text-hi">Set up a starting point</p><p className="mt-1 text-xs text-text-lo">Add private role-based templates and views. This never changes artist access.</p></div><Button size="sm" variant="secondary" onClick={()=>setOpen(true)}>Starter kits</Button></div>;
  return <section className="panel space-y-4 p-4"><div><p className="label-mono">Add role-based starter kits</p><p className="mt-1 text-sm text-text-lo">Combine roles, preview every item, or start blank. Existing work is never overwritten.</p></div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{KITS.map(([key,label])=><button key={key} type="button" aria-pressed={selected.includes(key)} onClick={()=>{setSelected((v)=>v.includes(key)?v.filter((x)=>x!==key):[...v,key]);setPreview(null);}} className={cn("rounded-input border p-3 text-left text-sm",selected.includes(key)?"border-ice bg-ice/10 text-text-hi":"border-line bg-bg-2/40 text-text-lo")}>{label}</button>)}</div>
    <div className="flex flex-wrap gap-3"><label className="text-xs text-text-lo">Primary home emphasis <select value={primary} onChange={(e)=>{setPrimary(e.target.value);setPreview(null);}} className="ml-2 h-8 rounded-input border border-line bg-bg-2 px-2"><option value="work">My Work</option><option value="schedule">Schedule</option><option value="roster">Roster</option><option value="campaigns">Campaigns</option><option value="touring">Touring</option><option value="custom">Custom</option></select></label><label className="flex items-center gap-2 text-xs text-text-lo"><input type="checkbox" checked={samples} onChange={(e)=>{setSamples(e.target.checked);setPreview(null);}} className="accent-[var(--ice)]" />Include private example tasks</label></div>
    {preview ? <div className="well p-3"><p className="text-sm text-text-hi">Preview · {preview.count} item{preview.count===1?"":"s"}</p><ul className="mt-2 space-y-1 text-xs text-text-lo">{preview.items.map((item)=><li key={item.content_key}>{String(item.payload.name??item.payload.title??item.content_key)} · {item.kind.replaceAll("_"," ")}</li>)}</ul></div>:null}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={()=>{setOpen(false);setPreview(null);}}>Remind me later</Button><Button variant="secondary" onClick={()=>{setSelected([]);setOpen(false);setPreview(null);toast("Your Pro workspace will stay blank.","ok");}}>Start blank</Button>{preview?<Button disabled={install.isPending} onClick={()=>install.mutate()}>{install.isPending?"Adding…":"Add these items"}</Button>:<Button disabled={!selected.length||previewMutation.isPending} onClick={()=>previewMutation.mutate()}>{previewMutation.isPending?"Preparing…":"Preview"}</Button>}</div>
  </section>;
}
