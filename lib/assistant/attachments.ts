/**
 * Attachment helpers for the floating assistant.
 * Kept small — vision/file parts ride along on the same single model call.
 */

export const ASSISTANT_ATTACH_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.json,image/*";

export const ASSISTANT_MAX_ATTACHMENTS = 3;
export const ASSISTANT_MAX_ATTACH_BYTES = 4 * 1024 * 1024;

export type AssistantAttachmentKind = "image" | "pdf" | "text";

export type AssistantAttachment = {
  kind: AssistantAttachmentKind;
  name: string;
  mime: string;
  /** Raw base64 without data: prefix — server rebuilds the data URL. */
  dataBase64: string;
  /** For text kind, decoded content (also sent as base64 for transport). */
  text?: string;
};

export function kindForAssistantFile(file: File): AssistantAttachmentKind | null {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    mime.startsWith("text/") ||
    /\.(txt|md|csv|json)$/.test(name)
  ) {
    return "text";
  }
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

/** Turn a picked File into a transportable attachment (client-side). */
export async function fileToAssistantAttachment(
  file: File,
): Promise<AssistantAttachment> {
  if (file.size > ASSISTANT_MAX_ATTACH_BYTES) {
    throw new Error(`"${file.name}" is too large — keep attachments under 4 MB.`);
  }
  const kind = kindForAssistantFile(file);
  if (!kind) {
    throw new Error(
      `"${file.name}" isn't a type the assistant can read. Try an image, PDF, or text file.`,
    );
  }

  if (kind === "text") {
    const text = (await readAsText(file)).slice(0, 20_000);
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return {
      kind,
      name: file.name,
      mime: file.type || "text/plain",
      dataBase64: btoa(binary),
      text,
    };
  }

  const dataUrl = await readAsDataUrl(file);
  const comma = dataUrl.indexOf(",");
  const dataBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return {
    kind,
    name: file.name,
    mime: file.type || (kind === "pdf" ? "application/pdf" : "image/png"),
    dataBase64,
  };
}
