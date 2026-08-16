"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { fetchProAvailability, fetchProSchedule, saveProAvailability, type ProAvailability } from "@/lib/api/team-operations";
import { errorMessage } from "@/lib/utils";

export function ProSchedulePanel() {
  const range = React.useMemo(() => { const from=new Date();from.setHours(0,0,0,0);const to=new Date(from);to.setDate(to.getDate()+45);return {from,to}; }, []);
  const schedule = useQuery({ queryKey: ["team-operations","schedule",range.from.toISOString()], queryFn: () => fetchProSchedule(range.from,range.to) });
  const availability = useQuery({ queryKey: ["team-operations","availability"], queryFn: fetchProAvailability });
  const [form,setForm] = React.useState<ProAvailability | null>(null);
  const qc=useQueryClient();const {toast}=useToast();
  React.useEffect(() => { if (availability.data) setForm(availability.data); }, [availability.data]);
  const save=useMutation({ mutationFn: () => saveProAvailability(form!), onSuccess:()=>{qc.invalidateQueries({queryKey:["team-operations","availability"]});toast("Availability updated.","ok");},onError:(e)=>toast(errorMessage(e,"Couldn’t update availability.")) });
  return <div className="space-y-5">
    {form ? <section className="panel-quiet space-y-3 p-4"><div><p className="label-mono">Availability</p><p className="mt-1 text-xs text-text-lo">Private by default. Share only the status details you enter here.</p></div><div className="grid gap-3 sm:grid-cols-3">
      <select aria-label="Availability status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as ProAvailability["status"]})} className="h-9 rounded-input border border-line bg-bg-2 px-2 text-sm"><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select>
      <Input type="date" aria-label="Available until" value={form.untilDate ?? ""} onChange={(e)=>setForm({...form,untilDate:e.target.value||null})} />
      <Input aria-label="Timezone" value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})} placeholder="America/Denver" />
    </div><Input value={form.note} maxLength={160} onChange={(e)=>setForm({...form,note:e.target.value})} placeholder="Short availability note" />
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-text-lo"><input type="checkbox" checked={form.shareWithTeams} onChange={(e)=>setForm({...form,shareWithTeams:e.target.checked})} className="accent-[var(--ice)]" />Share this declared availability with my artist teams</label><Button size="sm" disabled={save.isPending} onClick={()=>save.mutate()}>Save availability</Button></div></section> : null}
    <section><p className="label-mono">Next 45 days</p><p className="mt-1 text-sm text-text-lo">Your private combined agenda. Artists cannot see other artists or conflicts here.</p>
      {schedule.isLoading ? <div className="mt-4 h-32 animate-pulse rounded-panel bg-bg-2/40" /> : (schedule.data??[]).length===0 ? <p className="mt-4 panel-quiet p-4 text-sm text-text-lo">No readable calendar items in this range.</p> : <ul className="mt-4 space-y-2">{schedule.data!.map((item)=><li key={item.eventId} className="well flex items-center gap-3 p-3"><div className="w-24 shrink-0 font-data text-xs text-text-lo">{item.allDay ? item.startDate : new Date(item.startsAt!).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-hi">{item.title}</p><p className="text-xs text-ice">{item.artistName}</p></div><Button asChild size="sm" variant="secondary"><Link href={item.href}>Open</Link></Button></li>)}</ul>}
    </section>
  </div>;
}
