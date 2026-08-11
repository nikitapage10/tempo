import { createClient } from "@/lib/supabase/client";
import { buildMessageMediaPath, deleteFile, uploadFile } from "@/lib/storage";
import type { MessageAttachment } from "@/lib/types";

export const MESSAGE_ATTACHMENT_ACCEPT = "image/*,audio/*,.pdf,.txt,.doc,.docx,.zip";
export const MESSAGE_ATTACHMENT_LIMIT = 4;
export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadMessageAttachments(files: File[], scope: "direct" | "support" | "scene", threadId: string, onProgress?: (fileIndex: number, percent: number) => void, signal?: AbortSignal): Promise<MessageAttachment[]> {
  if (files.length > MESSAGE_ATTACHMENT_LIMIT) throw new Error(`Attach up to ${MESSAGE_ATTACHMENT_LIMIT} files at a time.`);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in again before uploading.");
  const attachments: MessageAttachment[] = [];
  try {
    for (const file of files) {
      if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
      const path = buildMessageMediaPath({ userId: user.id, scope, threadId, attachmentId: crypto.randomUUID(), filename: file.name });
      await uploadFile(path, file, { contentType: file.type || undefined, onProgress: onProgress ? (percent) => onProgress(attachments.length, percent) : undefined, signal });
      attachments.push({ path, name: file.name, type: file.type || "application/octet-stream", size: file.size });
    }
  } catch (error) {
    await Promise.allSettled(attachments.map((attachment) => deleteFile(attachment.path)));
    throw error;
  }
  return attachments;
}

export async function getMessageAttachmentUrl(input: { scope: "direct" | "support" | "scene"; threadId: string; path: string }) {
  const response = await fetch("/api/messages/attachments/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.url !== "string") throw new Error(body?.error ?? "Couldn’t open this attachment.");
  return body.url as string;
}
