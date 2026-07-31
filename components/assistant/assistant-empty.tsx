"use client";

type Props = {
  onPick: (prompt: string) => void;
  disabled?: boolean;
};

const STARTERS = [
  "What needs my attention?",
  "How do stages work?",
  "What's due this week?",
  "Report a bug",
] as const;

export function AssistantEmpty({ onPick, disabled }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-hi">
        Ask about TEMPO or your catalog. I can propose a small change — you
        confirm before anything is written.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt)}
            className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:bg-ice/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
