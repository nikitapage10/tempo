import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({ label, value, detail, icon: Icon, tone = "ice" }: { label: string; value: string | number; detail?: string; icon?: LucideIcon; tone?: "ice" | "amber" | "violet" | "ok" | "warn" }) {
  return (
    <SpotlightCard tone={tone} className="min-h-32 p-5">
      <div className="flex items-center justify-between gap-3"><p className="label-mono text-text-lo">{label}</p>{Icon ? <span className={cn("flex size-8 items-center justify-center rounded-full border", tone === "amber" ? "border-amber/20 bg-amber/10 text-amber" : tone === "violet" ? "border-violet/20 bg-violet/10 text-violet" : tone === "ok" ? "border-ok/20 bg-ok/10 text-ok" : tone === "warn" ? "border-warn/20 bg-warn/10 text-warn" : "border-ice/20 bg-ice/10 text-ice")}><Icon className="size-4"/></span> : null}</div>
      <p className="stat-value mt-4 text-text-hi">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-lo">{detail}</p> : null}
    </SpotlightCard>
  );
}
