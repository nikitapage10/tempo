import { SpotlightCard } from "@/components/ui/spotlight-card";

export function StatTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <SpotlightCard className="p-4">
      <p className="label-mono text-text-lo">{label}</p>
      <p className="stat-value mt-3 text-text-hi">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-lo">{detail}</p> : null}
    </SpotlightCard>
  );
}
