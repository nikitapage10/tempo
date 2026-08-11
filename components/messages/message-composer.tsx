"use client";

import * as React from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { VoiceInput } from "@/components/import/voice-input";
import { VoiceNoteRecorder } from "@/components/messages/voice-note-recorder";
import { useToast } from "@/components/ui/toast";
import { useAudioInputs } from "@/hooks/use-audio-inputs";
import { transcribeAssistantVoice } from "@/lib/api/assistant";
import { MESSAGE_ATTACHMENT_ACCEPT, MESSAGE_ATTACHMENT_LIMIT, uploadMessageAttachments } from "@/lib/api/message-attachments";
import type { ConversationMessage, MessageAttachment } from "@/lib/types";
import { messageDraftStorageKey } from "@/lib/messages/behavior";
import { cn } from "@/lib/utils";

type PendingFile = { file: File; metadata?: Partial<MessageAttachment> };

type Props = {
  scope: "direct" | "support" | "scene";
  threadId: string;
  onSend: (input: { body: string; media: MessageAttachment[]; replyToMessageId?: string | null }) => Promise<void> | void;
  pending?: boolean;
  compact?: boolean;
  placeholder?: string;
  draftKey?: string;
  replyTo?: Pick<ConversationMessage, "id" | "body" | "deleted_at"> | null;
  onCancelReply?: () => void;
  onTyping?: (typing: boolean) => void;
};

export function MessageComposer({ scope, threadId, onSend, pending, compact = false, placeholder = "Write a message...", draftKey, replyTo, onCancelReply, onTyping }: Props) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<PendingFile[]>([]);
  const [working, setWorking] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dictationBaseRef = React.useRef("");
  const typingStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  const { devices, deviceId, setDeviceId, refresh } = useAudioInputs();
  const disabled = pending || working;

  React.useEffect(() => {
    if (!draftKey) return;
    setText(localStorage.getItem(messageDraftStorageKey(draftKey)) ?? "");
  }, [draftKey]);

  React.useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      const key = messageDraftStorageKey(draftKey);
      if (text) localStorage.setItem(key, text);
      else localStorage.removeItem(key);
    }, 250);
    return () => clearTimeout(timer);
  }, [draftKey, text]);

  React.useEffect(() => () => {
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    uploadAbortRef.current?.abort();
    onTyping?.(false);
  }, [onTyping]);

  function updateText(next: string) {
    setText(next.slice(0, 5000));
    onTyping?.(Boolean(next.trim()));
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => onTyping?.(false), 2_500);
  }

  function addFiles(next: PendingFile[]) {
    setFiles((current) => [...current, ...next].slice(0, MESSAGE_ATTACHMENT_LIMIT));
  }

  async function submit() {
    if ((!text.trim() && !files.length) || disabled) return;
    setWorking(true);
    try {
      uploadAbortRef.current = files.length ? new AbortController() : null;
      const uploaded = files.length
        ? await uploadMessageAttachments(files.map((item) => item.file), scope, threadId, (index, percent) => setUploadProgress(Math.round(((index + percent / 100) / files.length) * 100)), uploadAbortRef.current?.signal)
        : [];
      const media = uploaded.map((item, index) => ({ ...item, ...files[index]?.metadata }));
      await onSend({ body: text.trim(), media, replyToMessageId: replyTo?.id ?? null });
      setText("");
      setFiles([]);
      onTyping?.(false);
      onCancelReply?.();
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't send that message.");
    } finally {
      uploadAbortRef.current = null;
      setWorking(false);
      setUploadProgress(null);
    }
  }

  async function transcribe(file: File) {
    setWorking(true);
    try {
      const spoken = await transcribeAssistantVoice(file);
      setText((current) => `${current.trim()} ${spoken}`.trim().slice(0, 5000));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't hear that recording.");
    } finally {
      setWorking(false);
    }
  }

  return <div className={cn("space-y-2", compact && "space-y-1.5")}
    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files).map((file) => ({ file }))); }}
    onPaste={(event) => { const pasted = Array.from(event.clipboardData.files); if (pasted.length) addFiles(pasted.map((file) => ({ file }))); }}>
    {replyTo ? <div className="flex items-start gap-2 rounded-input border-l-2 border-ice bg-bg-2 px-3 py-2 text-xs"><div className="min-w-0 flex-1"><p className="text-ice">Replying to a message</p><p className="truncate text-text-lo">{replyTo.deleted_at ? "Deleted message" : replyTo.body || "Attachment"}</p></div><button type="button" aria-label="Cancel reply" onClick={onCancelReply}><X className="size-3.5"/></button></div> : null}
    {files.length ? <div className="flex flex-wrap gap-1.5">{files.map(({ file }, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-chip border border-line bg-bg-2 px-2 py-1 text-[10px] text-text-lo"><FileText className="size-3"/><span className="max-w-40 truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="size-3"/></button></span>)}</div> : null}
    <div className={cn("flex items-end gap-1 rounded-card border border-line bg-bg-2 p-1.5 focus-within:border-ice/45", dragging && "border-ice bg-ice/5")}>
      <input ref={inputRef} type="file" accept={MESSAGE_ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(event) => addFiles(Array.from(event.target.files ?? []).map((file) => ({ file })))}/>
      <button type="button" aria-label="Attach files" title="Attach up to 4 files, 10 MB each" disabled={disabled || files.length >= MESSAGE_ATTACHMENT_LIMIT} onClick={() => inputRef.current?.click()} className="rounded-input p-2 text-text-lo hover:text-ice disabled:opacity-40"><Paperclip className="size-4"/></button>
      <textarea value={text} onChange={(event) => updateText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} rows={compact ? 1 : 2} maxLength={5000} placeholder={placeholder} className={cn("max-h-28 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-text-hi placeholder:text-text-lo focus:outline-none", compact && "min-h-9")}/>
      <VoiceInput disabled={disabled} deviceId={deviceId} onStart={() => { dictationBaseRef.current = text.trim(); void refresh(); }} onTranscript={(spoken) => setText(`${dictationBaseRef.current} ${spoken}`.trim().slice(0, 5000))} onRecorded={(file) => void transcribe(file)}/>
      <VoiceNoteRecorder deviceId={deviceId} disabled={disabled || files.length >= MESSAGE_ATTACHMENT_LIMIT} onRecorded={(file, metadata) => addFiles([{ file, metadata }])} onError={(message) => toast(message)}/>
      <button type="button" aria-label="Send message" disabled={disabled || (!text.trim() && !files.length)} onClick={() => void submit()} className="rounded-input p-2 text-ice hover:text-text-hi disabled:text-text-lo disabled:opacity-40"><Send className="size-4"/></button>
    </div>
    <div className="flex min-h-6 items-center gap-2">
      {devices.length ? <label className="flex items-center gap-1 text-[10px] text-text-lo"><span>Mic</span><select value={deviceId ?? ""} onChange={(event) => setDeviceId(event.target.value || null)} className="max-w-44 rounded-input border border-line bg-bg-1 px-1.5 py-1 text-[10px] text-text-hi"><option value="">System default</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label> : null}
      {working ? <p className="text-[10px] text-text-lo">{files.length ? `Uploading${uploadProgress !== null ? ` ${uploadProgress}%` : ""} and sending...` : "Working..."}</p> : null}
      {working && files.length ? <button type="button" onClick={() => uploadAbortRef.current?.abort()} className="text-[10px] text-warn">Cancel upload</button> : null}
    </div>
  </div>;
}
