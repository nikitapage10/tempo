"use client";
import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, typedValue, busy, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; typedValue?: string; busy?: boolean; onConfirm: () => void | Promise<void> }) {
  const [value, setValue] = React.useState("");
  React.useEffect(() => { if (!open) setValue(""); }, [open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title={title} description={description} onClose={() => onOpenChange(false)}>
    {typedValue ? <div className="mb-4"><p className="mb-2 text-xs text-text-lo">Type <strong className="text-text-hi">{typedValue}</strong> to confirm.</p><Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" /></div> : null}
    <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={(!!typedValue && value !== typedValue) || busy} onClick={() => void onConfirm()}>{busy ? "…" : confirmLabel}</Button></div>
  </DialogContent></Dialog>;
}
