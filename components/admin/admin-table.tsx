import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export type AdminColumn<T> = { key: string; label: string; className?: string; render: (row: T) => React.ReactNode };

export function AdminTable<T>({ columns, rows, rowKey, empty = "Nothing to show." }: { columns: AdminColumn<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: string }) {
  return <div className="panel overflow-hidden">
    <div className="hidden grid-cols-12 gap-3 border-b border-line px-4 py-3 md:grid">{columns.map((column) => <div key={column.key} className={cn("label-mono", column.className)}>{column.label}</div>)}</div>
    {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-text-lo">{empty}</p> : <div className="divide-y divide-line">{rows.map((row) => <div key={rowKey(row)} className="grid gap-2 px-4 py-3 md:grid-cols-12 md:gap-3">{columns.map((column) => <div key={column.key} data-label={column.label} className={cn("min-w-0 text-sm before:mr-2 before:text-[11px] before:uppercase before:text-text-lo before:content-[attr(data-label)] md:before:hidden", column.className)}>{column.render(row)}</div>)}</div>)}</div>}
  </div>;
}

export function StatusChip({ status }: { status: string }) {
  const tone = status === "active" || status === "actioned" ? "border-ok/35 bg-ok/10 text-ok" : status === "suspended" || status === "open" ? "border-warn/35 bg-warn/10 text-warn" : undefined;
  return <Chip className={tone}>{status}</Chip>;
}
