"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Mic, Paperclip, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Bubble, Dot } from "@/components/ui/chat-bubble";
import { useToast } from "@/components/ui/toast";
import { VoiceInput } from "@/components/import/voice-input";
import { IMPORT_DOCUMENT_ACCEPT, IMPORT_IMAGE_ACCEPT } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import {
  addFileSource,
  addTextSource,
  askFollowups,
  extractAll,
  removeSource,
  type Followup,
  type ImportSource,
  type ImportSourceKind,
} from "@/lib/api/onboarding-imports";
import { cn } from "@/lib/utils";

type ArtistTurn = { kind: "artist"; sourceId: string };
type TempoTurn = {
  kind: "tempo";
  id: string;
  observation: string;
  questions: Followup[];
};
/** One entry in the transcript, in the order it happened. */
type Turn = ArtistTurn | TempoTurn;

type IntakeCanvasProps = {
  importId: string;
  sources: ImportSource[];
  onSourcesChanged: () => void;
  onReady: () => void;
  busy: boolean;
};

const KIND_ICON: Record<ImportSourceKind, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  voice: Mic,
  image: ImageIcon,
  document: Upload,
};

const KIND_LABEL: Record<ImportSourceKind, string> = {
  text: "Notes",
  voice: "Voice note",
  image: "Image",
  document: "Document",
};

function kindForFile(file: File): Exclude<ImportSourceKind, "text"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return "voice";
  return "document";
}

/**
 * What TEMPO says back after something is added. Deliberately short and
 * factual — it is acknowledging receipt, not performing a personality, and it
 * must never imply anything has been read or created yet.
 */
function acknowledge(sources: ImportSource[]): string {
  const n = sources.length;
  if (n === 0) return "";
  const files = sources.filter((s) => s.kind !== "text").length;
  const notes = n - files;

  const parts: string[] = [];
  if (notes) parts.push(`${notes} note${notes === 1 ? "" : "s"}`);
  if (files) parts.push(`${files} file${files === 1 ? "" : "s"}`);

  return `Got ${parts.join(" and ")}. Add more if you have it, or tell me that's everything.`;
}

export function IntakeCanvas({
  importId,
  sources,
  onSourcesChanged,
  onReady,
  busy,
}: IntakeCanvasProps) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  // The transcript is append-only. TEMPO's earlier questions have to stay on
  // screen next to the answers they prompted, otherwise replying to a question
  // erases it and the thread stops reading as a conversation.
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [enough, setEnough] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  // What was already typed when dictation started, so speech appends to it
  // instead of wiping it.
  const dictationBaseRef = React.useRef("");

  // Keep the newest message in view, the way a conversation behaves.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, uploading, thinking]);

  // Fold newly-added sources into the transcript in arrival order, and drop any
  // whose source the artist removed.
  React.useEffect(() => {
    setTurns((prev) => {
      const live = new Set(sources.map((s) => s.id));
      const kept = prev.filter((t) => t.kind !== "artist" || live.has(t.sourceId));
      const already = new Set(
        kept.filter((t): t is ArtistTurn => t.kind === "artist").map((t) => t.sourceId),
      );
      const added: Turn[] = sources
        .filter((s) => !already.has(s.id))
        .map((s) => ({ kind: "artist" as const, sourceId: s.id }));

      if (added.length === 0 && kept.length === prev.length) return prev;
      return [...kept, ...added];
    });
  }, [sources]);

  /**
   * Ask what's still missing. Runs after each thing the artist adds, so the
   * screen behaves like a conversation rather than a form they fill in blind.
   */
  const requestFollowups = React.useCallback(
    async (readFilesFirst = false) => {
      setThinking(true);
      try {
        // Attached files are registered as pending and mean nothing to the model
        // until they've been read. Do that now rather than at the end, so a
        // screenshot can actually be discussed in the conversation it arrived in.
        if (readFilesFirst) {
          await extractAll(importId);
          onSourcesChanged();
        }
        const result = await askFollowups(importId);
        setEnough(result.enoughToProceed);
        if (result.observation || result.questions.length > 0) {
          setTurns((prev) => [
            ...prev,
            {
              kind: "tempo",
              id: `t${Date.now()}`,
              observation: result.observation,
              questions: result.questions,
            },
          ]);
        }
      } finally {
        setThinking(false);
      }
    },
    [importId, onSourcesChanged],
  );

  async function handleFiles(files: File[]) {
    for (const file of files) {
      setUploading(file.name);
      setProgress(0);
      try {
        await addFileSource(importId, file, kindForFile(file), setProgress);
        onSourcesChanged();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn’t add that file.");
      }
    }
    setUploading(null);
    setProgress(null);
    void requestFollowups(true);
  }

  async function handleVoice(file: File) {
    setUploading(file.name);
    setProgress(0);
    try {
      await addFileSource(importId, file, "voice", setProgress);
      onSourcesChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add that recording.");
    }
    setUploading(null);
    setProgress(null);
    void requestFollowups(true);
  }

  async function handleSend(override?: string) {
    const trimmed = (override ?? text).trim();
    if (!trimmed) return;
    if (!override) setText("");
    try {
      await addTextSource(importId, trimmed);
      onSourcesChanged();
      void requestFollowups();
    } catch (err) {
      if (!override) setText(trimmed); // give it back rather than losing it
      toast(err instanceof Error ? err.message : "Couldn’t add that.");
    }
  }

  async function handleRemove(sourceId: string) {
    try {
      await removeSource(importId, sourceId);
      onSourcesChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t remove that.");
    }
  }

  const disabled = busy || uploading !== null;

  return (
    <Dropzone
      multiple
      className="flex h-[calc(100vh-13rem)] min-h-[30rem] flex-col overflow-hidden !rounded-panel !border-solid !border-line bg-gradient-to-b from-bg-1 to-bg-0 shadow-e3"
      accept={`${IMPORT_IMAGE_ACCEPT},${IMPORT_DOCUMENT_ACCEPT}`}
      disabled={disabled}
      onFiles={(files) => void handleFiles(files)}
    >
      {({ open, dragging }) => (
        <>
          {/* Transcript */}
          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {dragging ? (
              <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-ice bg-bg-0/80">
                <p className="font-display text-lg text-text-hi">Drop it in</p>
              </div>
            ) : null}

            <div className="mx-auto max-w-2xl space-y-4">
              <Bubble from="tempo">
                <p className="font-display text-base font-semibold tracking-tight text-text-hi">
                  Tell me what you&rsquo;re working on and I&rsquo;ll set your workspace up.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-lo">
                  Type it, say it out loud, or drop in whatever you already have —
                  screenshots of your project folders, a release spreadsheet, a PDF,
                  your notes. Rough is fine. Nothing gets added to your catalog until
                  you&rsquo;ve looked it over.
                </p>
              </Bubble>

              {turns.map((turn, index) => {
                if (turn.kind === "artist") {
                  const source = sources.find((s) => s.id === turn.sourceId);
                  if (!source) return null;
                  return (
                    <SourceBubble
                      key={source.id}
                      source={source}
                      disabled={disabled}
                      onRemove={() => void handleRemove(source.id)}
                    />
                  );
                }

                // Only the most recent question is still answerable by tapping —
                // older ones stay visible as part of the thread, but their
                // options have already been answered.
                const isLatest = index === turns.length - 1;

                return (
                  <Bubble key={turn.id} from="tempo">
                    <div className="space-y-3">
                      {turn.observation ? (
                        <p className="text-sm leading-relaxed text-text-hi">
                          {turn.observation}
                        </p>
                      ) : null}

                      {turn.questions.map((f, i) => (
                        <div key={`${turn.id}-${i}`}>
                          <p className="text-sm leading-relaxed text-text-hi">
                            {f.question}
                          </p>
                          {f.options.length > 0 && isLatest ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {f.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  disabled={disabled}
                                  // A tapped answer is just another thing they
                                  // told TEMPO — same path as typing it.
                                  onClick={() => void handleSend(option)}
                                  className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:bg-ice/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}

                      {isLatest && turn.questions.length > 0 ? (
                        <p className="text-xs text-text-lo">
                          Answer what you can, or skip ahead when you&rsquo;re ready.
                        </p>
                      ) : null}
                    </div>
                  </Bubble>
                );
              })}

              {uploading ? (
                <Bubble from="artist">
                  <p className="truncate text-sm text-text-hi">{uploading}</p>
                  <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-bg-0">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ice to-amber transition-all duration-hover"
                      style={{ width: `${progress ?? 0}%` }}
                    />
                  </div>
                </Bubble>
              ) : null}

              {thinking ? (
                <Bubble from="tempo">
                  <p className="flex items-center gap-2 text-sm text-text-lo">
                    <span className="flex gap-1" aria-hidden>
                      <Dot delay="0ms" />
                      <Dot delay="150ms" />
                      <Dot delay="300ms" />
                    </span>
                    <span className="sr-only">TEMPO is reading what you added</span>
                  </p>
                </Bubble>
              ) : null}

              <div ref={endRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-bg-1/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end gap-2 rounded-card border border-line bg-bg-2 p-2 shadow-e2 transition-colors duration-hover focus-within:border-ice/50">
                <button
                  type="button"
                  aria-label="Attach files"
                  title="Attach screenshots, spreadsheets, PDFs"
                  disabled={disabled}
                  onClick={open}
                  className="rounded-input p-2 text-text-lo transition-colors duration-hover hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
                >
                  <Paperclip className="size-4" />
                </button>

                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter for a new line — chat convention.
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  disabled={disabled}
                  rows={1}
                  placeholder="Tell TEMPO about your music…"
                  className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm text-text-hi placeholder:text-text-lo focus-visible:outline-none"
                />

                <VoiceInput
                  disabled={disabled}
                  onStart={() => {
                    dictationBaseRef.current = text.trim();
                  }}
                  onTranscript={(spoken) => {
                    const base = dictationBaseRef.current;
                    setText(base ? `${base} ${spoken}` : spoken);
                  }}
                  onRecorded={(file) => void handleVoice(file)}
                />

                <button
                  type="button"
                  aria-label="Send"
                  disabled={disabled || !text.trim()}
                  onClick={() => void handleSend()}
                  className={cn(
                    "rounded-input p-2 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                    text.trim() ? "text-ice hover:text-text-hi" : "text-text-lo opacity-40",
                  )}
                >
                  <Send className="size-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] leading-relaxed text-text-lo">
                  What you add here is sent to an AI service to be read. Remove anything
                  you&rsquo;d rather not send.
                </p>
                <Button
                  type="button"
                  size="sm"
                  // Never block them on answering — it's their call when to stop.
                  variant={enough ? "default" : "secondary"}
                  disabled={disabled || sources.length === 0}
                  onClick={onReady}
                >
                  That&rsquo;s everything
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Dropzone>
  );
}

function SourceBubble({
  source,
  disabled,
  onRemove,
}: {
  source: ImportSource;
  disabled: boolean;
  onRemove: () => void;
}) {
  const Icon = KIND_ICON[source.kind];
  const isNote = source.kind === "text";

  return (
    <div className="group flex justify-end">
      <div className="flex max-w-[85%] items-start gap-2">
        <button
          type="button"
          aria-label={`Remove ${source.label || "this item"}`}
          disabled={disabled}
          onClick={onRemove}
          className="mt-3 rounded-input p-1 text-text-lo opacity-0 transition-all duration-hover hover:text-warn focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>

        <div className="min-w-0 rounded-card rounded-br-sm border border-ice/30 bg-gradient-to-br from-ice/15 to-ice/5 px-4 py-3 shadow-e1">
          {isNote ? (
            // Their own words back, not a filename.
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">
              {source.extracted_text || source.label || "Notes"}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Icon className="size-3.5 shrink-0 text-text-lo" />
              <p className="min-w-0 flex-1 truncate text-sm text-text-hi">
                {source.label || KIND_LABEL[source.kind]}
              </p>
            </div>
          )}
          {!isNote ? (
            <p className="mt-1 font-data text-[11px] text-text-lo">
              {KIND_LABEL[source.kind]}
              {source.byte_size ? ` · ${formatFileSize(source.byte_size)}` : ""}
            </p>
          ) : null}
          {source.error ? (
            <p className="mt-1 text-[11px] text-warn">{source.error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
