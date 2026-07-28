/**
 * Turns one piece of source material into plain text.
 *
 * SERVER ONLY. Structured formats are parsed here rather than shipped to the
 * model: it's cheaper, it doesn't hallucinate a cell value, and a 4000-row
 * spreadsheet stays readable. Only images, PDFs and voice memos actually need
 * the model to read them.
 */

import ExcelJS from "exceljs";
import mammoth from "mammoth";

import {
  IMPORT_MODEL,
  MAX_TRANSCRIBE_BYTES,
  TRANSCRIBE_MODEL,
  createOpenAIClient,
} from "@/lib/ai/openai";

/** Keeps one enormous spreadsheet from eating the whole context window. */
export const MAX_SHEET_ROWS = 500;
/** Extracted text is truncated per source so one file can't crowd out the rest. */
export const MAX_EXTRACT_CHARS = 40_000;

export type SourceKind = "text" | "voice" | "image" | "document";

export type ExtractInput = {
  kind: SourceKind;
  label: string | null;
  mimeType: string | null;
  /** Inline text for kind === "text"; otherwise the downloaded file. */
  text?: string | null;
  bytes?: Buffer | null;
};

export type ExtractResult = {
  text: string;
  warning?: string;
};

function truncate(text: string): ExtractResult {
  if (text.length <= MAX_EXTRACT_CHARS) return { text };
  return {
    text: text.slice(0, MAX_EXTRACT_CHARS),
    warning: "This file was long, so only the beginning was read.",
  };
}

function extensionOf(label: string | null): string {
  if (!label) return "";
  const dot = label.lastIndexOf(".");
  return dot >= 0 ? label.slice(dot).toLowerCase() : "";
}

/** Spreadsheets read as pipe-separated rows — compact and unambiguous for a model. */
async function extractSpreadsheet(bytes: Buffer, ext: string): Promise<ExtractResult> {
  const workbook = new ExcelJS.Workbook();

  if (ext === ".csv") {
    // ExcelJS's csv.read wants a stream.
    const { Readable } = await import("node:stream");
    const stream = Readable.from(bytes);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  }

  const lines: string[] = [];
  let truncatedSheet = false;

  workbook.eachSheet((sheet) => {
    lines.push(`## Sheet: ${sheet.name}`);
    let rowCount = 0;

    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (rowCount >= MAX_SHEET_ROWS) {
        truncatedSheet = true;
        return;
      }
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = values.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        if (typeof cell === "object") {
          const rich = cell as { text?: string; result?: unknown; hyperlink?: string };
          if (typeof rich.text === "string") return rich.text;
          if (rich.result !== undefined) return String(rich.result);
          if (rich.hyperlink) return rich.hyperlink;
          return "";
        }
        return String(cell);
      });
      if (cells.some((c) => c.trim() !== "")) {
        lines.push(cells.join(" | "));
      }
      rowCount += 1;
    });
  });

  const result = truncate(lines.join("\n"));
  if (truncatedSheet && !result.warning) {
    result.warning = `Only the first ${MAX_SHEET_ROWS} rows of each sheet were read.`;
  }
  return result;
}

/** Screenshots: a Finder window, an Ableton project list, a whiteboard, a notes app. */
async function extractImage(bytes: Buffer, mimeType: string | null): Promise<ExtractResult> {
  const client = createOpenAIClient();
  const base64 = bytes.toString("base64");
  const mime = mimeType || "image/png";

  const response = await client.responses.create({
    model: IMPORT_MODEL,
    store: false,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "This is a screenshot or photo from a musician who is importing their catalog into a music project manager. " +
              "Transcribe everything readable — file names, folder names, song titles, dates, BPMs, keys, statuses, checklists, notes. " +
              "Preserve folder structure and grouping as indented text. " +
              "Do not interpret, summarise, or invent anything that isn't visible. " +
              "If the image contains nothing relevant to music projects, say exactly: NO_RELEVANT_CONTENT",
          },
          { type: "input_image", image_url: `data:${mime};base64,${base64}`, detail: "high" },
        ],
      },
    ],
  });

  const text = response.output_text?.trim() || "";
  if (!text || text.includes("NO_RELEVANT_CONTENT")) {
    return { text: "", warning: "Nothing readable about your music was found in this image." };
  }
  return truncate(text);
}

/** PDFs go to the model directly — it gets both the extracted text and page images. */
async function extractPdf(bytes: Buffer, label: string | null): Promise<ExtractResult> {
  const client = createOpenAIClient();
  const base64 = bytes.toString("base64");

  const response = await client.responses.create({
    model: IMPORT_MODEL,
    store: false,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Transcribe everything in this document that relates to a musician's catalog — song titles, release dates, " +
              "collaborators, statuses, tasks, credits, metadata. Preserve tables as rows. Do not summarise or invent.",
          },
          {
            type: "input_file",
            filename: label || "document.pdf",
            file_data: `data:application/pdf;base64,${base64}`,
          },
        ],
      },
    ],
  });

  return truncate(response.output_text?.trim() || "");
}

async function extractVoice(
  bytes: Buffer,
  label: string | null,
  mimeType: string | null,
): Promise<ExtractResult> {
  if (bytes.byteLength > MAX_TRANSCRIBE_BYTES) {
    return { text: "", warning: "That voice note is too long to transcribe. Keep it under 25 MB." };
  }

  const client = createOpenAIClient();
  const file = new File([new Uint8Array(bytes)], label || "voice-note.webm", {
    type: mimeType || "audio/webm",
  });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
  });

  const text = (transcription.text || "").trim();
  if (!text) {
    return { text: "", warning: "Nothing could be heard in that recording." };
  }
  return truncate(text);
}

export async function extractSource(input: ExtractInput): Promise<ExtractResult> {
  const ext = extensionOf(input.label);

  if (input.kind === "text") {
    return truncate((input.text || "").trim());
  }

  const bytes = input.bytes;
  if (!bytes || bytes.byteLength === 0) {
    return { text: "", warning: "That file came through empty." };
  }

  if (input.kind === "voice") {
    return extractVoice(bytes, input.label, input.mimeType);
  }

  if (input.kind === "image") {
    return extractImage(bytes, input.mimeType);
  }

  // Documents.
  if (ext === ".csv" || ext === ".xlsx" || ext === ".xlsm") {
    return extractSpreadsheet(bytes, ext === ".csv" ? ".csv" : ".xlsx");
  }
  if (ext === ".pdf") {
    return extractPdf(bytes, input.label);
  }
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return truncate((value || "").trim());
  }
  if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".rtf") {
    return truncate(bytes.toString("utf8").trim());
  }

  return {
    text: "",
    warning: `TEMPO can't read ${ext || "that file type"} yet. Try a spreadsheet, PDF, Word file, or a screenshot.`,
  };
}
