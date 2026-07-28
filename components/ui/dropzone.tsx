"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DropzoneProps = {
  /** Called with everything dropped or picked. Single-file callers take [0]. */
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  /** Render prop so callers can put their own controls inside the zone. */
  children: (api: { open: () => void; dragging: boolean }) => ReactNode;
};

/**
 * The dashed drop target used for bounces, assets, and Import Studio material.
 *
 * Native HTML5 drag events — same as the two hand-rolled versions this replaces,
 * so the behaviour and the ice-tinted active state are unchanged.
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  className,
  children,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function emit(list: FileList | null) {
    if (disabled) return;
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      className={cn(
        "rounded-card border border-dashed transition-colors duration-hover",
        dragging ? "border-ice bg-ice/5" : "border-line bg-bg-2/40",
        !disabled && !dragging && "hover:border-ice/50",
        className,
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
    >
      {children({ open: () => inputRef.current?.click(), dragging })}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
