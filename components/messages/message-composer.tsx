"use client";

import * as React from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { VoiceInput } from "@/components/import/voice-input";
import { useToast } from "@/components/ui/toast";
import { transcribeAssistantVoice } from "@/lib/api/assistant";
import { MESSAGE_ATTACHMENT_ACCEPT, MESSAGE_ATTACHMENT_LIMIT, uploadMessageAttachments } from "@/lib/api/message-attachments";
import type { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageComposer({ scope, threadId, onSend, pending, compact = false, placeholder = "Write a message…" }: { scope: "direct" | "support"; threadId: string; onSend: (input: { body: string; media: MessageAttachment[] }) => Promise<void> | void; pending?: boolean; compact?: boolean; placeholder?: string }) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [working, setWorking] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dictationBaseRef = React.useRef("");
  const disabled = pending || working;

  async function submit() {
    if ((!text.trim() && !files.length) || disabled) return;
    setWorking(true);
    try {
      const media = files.length ? await uploadMessageAttachments(files, scope, threadId) : [];
      await onSend({ body: text.trim(), media });
      setText(""); setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t send that message."); }
    finally { setWorking(false); }
  }

  async function transcribe(file: File) {
    setWorking(true);
    try { const spoken = await transcribeAssistantVoice(file); setText((current) => `${current.trim()} ${spoken}`.trim().slice(0, 5000)); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t hear that recording."); }
    finally { setWorking(false); }
  }

  return <div className={cn("space-y-2", compact && "space-y-1.5")}>
    {files.length ? <div className="flex flex-wrap gap-1.5">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-chip border border-line bg-bg-2 px-2 py-1 text-[10px] text-text-lo"><FileText className="size-3"/><span className="max-w-40 truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="size-3"/></button></span>)}</div> : null}
    <div className="flex items-end gap-1 rounded-card border border-line bg-bg-2 p-1.5 focus-within:border-ice/45">
      <input ref={inputRef} type="file" accept={MESSAGE_ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(event) => { const next = Array.from(event.target.files ?? []); setFiles((current) => [...current, ...next].slice(0, MESSAGE_ATTACHMENT_LIMIT)); }}/>
      <button type="button" aria-label="Attach files" title="Attach up to 4 files, 10 MB each" disabled={disabled || files.length >= MESSAGE_ATTACHMENT_LIMIT} onClick={() => inputRef.current?.click()} className="rounded-input p-2 text-text-lo hover:text-ice disabled:opacity-40"><Paperclip className="size-4"/></button>
      <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 5000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} rows={compact ? 1 : 2} maxLength={5000} placeholder={placeholder} className={cn("max-h-28 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-text-hi placeholder:text-text-lo focus:outline-none", compact && "min-h-9")}/>
      <VoiceInput disabled={disabled} onStart={() => { dictationBaseRef.current = text.trim(); }} onTranscript={(spoken) => setText(`${dictationBaseRef.current} ${spoken}`.trim().slice(0, 5000))} onRecorded={(file) => void transcribe(file)}/>
      <button type="button" aria-label="Send message" disabled={disabled || (!text.trim() && !files.length)} onClick={() => void submit()} className="rounded-input p-2 text-ice hover:text-text-hi disabled:text-text-lo disabled:opacity-40"><Send className="size-4"/></button>
    </div>
    {working ? <p className="text-[10px] text-text-lo">{files.length ? "Uploading and sending…" : "Working…"}</p> : null}
  </div>;
}
