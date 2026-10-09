"use client";

/**
 * <UploadTile>: an empty stamp slot that takes files. A <label> wrapping a visually hidden
 * file input, so it works with tap, click, keyboard (Tab → Enter/Space) and screen readers.
 * Desktop drag-and-drop highlights the slot. When the limit is reached it says so plainly and
 * stops accepting files. The input is reset after each pick, so the same file can be re-picked.
 */
import { useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { IconPlus } from "@/components/ui/icons";
import "./forms.css";

export interface UploadTileProps {
  onFiles: (files: File[]) => void;
  /** e.g. "image/*" or "audio/*". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Shows `limitLabel` and refuses more files. */
  limitReached?: boolean;
  /** Default "Add photos". */
  label?: ReactNode;
  /** Small line under the label, e.g. "Up to 15 · JPG, PNG or HEIC". */
  hint?: ReactNode;
  /** Shown instead of the label when the limit is reached. Default "That's a full envelope". */
  limitLabel?: ReactNode;
  icon?: ReactNode;
  id?: string;
  name?: string;
  /** Passed to the input (e.g. "environment" to open the camera directly). Usually leave unset. */
  capture?: "user" | "environment";
  className?: string;
  "aria-describedby"?: string;
  /** Force the drag-over look (style guide, visual tests). */
  dragging?: boolean;
}

export function UploadTile({
  onFiles,
  accept,
  multiple,
  disabled,
  limitReached,
  label = "Add photos",
  hint,
  limitLabel = "That's a full envelope",
  icon,
  id,
  name,
  capture,
  className,
  "aria-describedby": describedBy,
  dragging: forceDragging,
}: UploadTileProps) {
  const auto = useId();
  const inputId = id ?? `upload${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [dragOver, setDragging] = useState(false);
  const dragging = forceDragging || dragOver;
  const depth = useRef(0);
  const off = disabled || limitReached;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length && !off) onFiles(files);
  };

  const onDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    if (off || !Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    depth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    if (off) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (off) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      htmlFor={inputId}
      className={cn("sd-upload", className)}
      data-dragging={dragging ? "true" : undefined}
      data-disabled={off ? "true" : undefined}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        id={inputId}
        name={name}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={off}
        onChange={handleChange}
        aria-describedby={describedBy}
      />
      <span className="sd-upload__icon" aria-hidden>
        {icon ?? <IconPlus size={22} />}
      </span>
      <span className="sd-upload__label">{limitReached ? limitLabel : dragging ? "Drop to add" : label}</span>
      {hint && <span className="sd-upload__hint">{hint}</span>}
    </label>
  );
}
