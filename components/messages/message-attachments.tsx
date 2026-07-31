"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { getMessageAttachmentUrl } from "@/lib/api/message-attachments";
import type { MessageAttachment } from "@/lib/types";

function normalize(item: string | MessageAttachment): MessageAttachment {
  return typeof item === "string"
    ? { path: item, name: item.split("/").at(-1) ?? "Attachment", type: "application/octet-stream", size: 0 }
    : item;
}

function Attachment({ attachment, scope, threadId }: { attachment: MessageAttachment; scope: "direct" | "support"; threadId: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    void getMessageAttachmentUrl({ scope, threadId, path: attachment.path }).then((value) => { if (active) setUrl(value); }).catch(() => {});
    return () => { active = false; };
  }, [attachment.path, scope, threadId]);

  if (attachment.type.startsWith("image/") && url) {
    return <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-input border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- private signed URLs cannot use the image optimizer */}
      <img src={url} alt={attachment.name} className="max-h-48 w-full object-cover"/>
    </a>;
  }
  if (attachment.type.startsWith("audio/") && url) {
    return <div className="rounded-input border border-line bg-bg-0/30 p-2"><p className="mb-1 truncate text-[10px] text-text-lo">{attachment.name}</p><audio controls preload="none" src={url} className="h-8 w-full"/></div>;
  }
  return <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!url} className="flex items-center gap-2 rounded-input border border-line bg-bg-0/30 px-3 py-2 text-xs text-text-hi"><FileText className="size-4 text-ice"/><span className="min-w-0 flex-1 truncate">{attachment.name}</span><Download className="size-3.5 text-text-lo"/></a>;
}

export function MessageAttachments({ media, scope, threadId }: { media: (string | MessageAttachment)[] | undefined; scope: "direct" | "support"; threadId: string }) {
  if (!media?.length) return null;
  return <div className="mt-2 grid gap-1.5">{media.map((item, index) => { const attachment = normalize(item); return <Attachment key={`${attachment.path}-${index}`} attachment={attachment} scope={scope} threadId={threadId}/>; })}</div>;
}
