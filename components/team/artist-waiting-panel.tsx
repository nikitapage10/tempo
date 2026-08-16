"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type WaitingRow={kind:"task"|"review";id:string;title:string;due:string|null;href:string};
async function fetchWaiting(artistId:string):Promise<WaitingRow[]> {
  const supabase=createClient();const {data:spaces,error:spaceError}=await supabase.from("spaces").select("id").eq("artist_id",artistId);if(spaceError)throw spaceError;
  const ids=(spaces??[]).map((s)=>s.id);if(!ids.length)return [];
  const [{data:tasks,error:taskError},{data:reviews,error:reviewError}]=await Promise.all([
    supabase.from("tasks").select("id,title,due_date").in("space_id",ids).not("assigned_to_user_id","is",null).neq("status","done"),
    supabase.from("review_requests").select("id,request_text,due_at").eq("artist_id",artistId).eq("status","open"),
  ]);if(taskError)throw taskError;if(reviewError&&!/review_requests|schema cache/i.test(reviewError.message))throw reviewError;
  return [...(tasks??[]).map((t)=>({kind:"task" as const,id:t.id,title:t.title,due:t.due_date,href:`/tasks?edit=${t.id}`})),...(reviews??[]).map((r)=>({kind:"review" as const,id:r.id,title:r.request_text,due:r.due_at,href:`/team?tab=waiting&review=${r.id}`}))];
}
export function ArtistWaitingPanel({artistId}:{artistId:string}){
  const query=useQuery({queryKey:["team-operations","waiting",artistId],queryFn:()=>fetchWaiting(artistId),staleTime:15000});
  if(query.isLoading)return <div className="h-28 animate-pulse rounded-panel bg-bg-2/40"/>;
  if(query.isError)return <div className="panel-quiet p-4 text-sm text-warn">Waiting work couldn’t load.</div>;
  if(!query.data?.length)return <div className="panel-quiet p-4 text-sm text-text-lo">Nothing is waiting on the team.</div>;
  return <section><p className="label-mono">Waiting on the team ({query.data.length})</p><ul className="mt-3 space-y-2">{query.data.map((row)=><li key={`${row.kind}:${row.id}`} className="well flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-hi">{row.title}</p><p className="mt-1 text-xs capitalize text-text-lo">{row.kind}{row.due?` · ${new Date(row.due).toLocaleDateString()}`:""}</p></div><Button asChild size="sm" variant="secondary"><Link href={row.href}>Open</Link></Button></li>)}</ul></section>;
}
