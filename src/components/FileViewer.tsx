"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { isImage } from "@/lib/mime";
import type { Attachment } from "@/lib/types";

/** Full-bleed viewer for a receipt: an image, or a PDF in a frame. */
export function FileViewer({
  file,
  onClose,
}: {
  file: Attachment | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!file) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [file, onClose]);

  if (!file || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-ink/90"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 px-[18px] py-4 text-canvas">
        <span className="truncate text-sm">{file.name}</span>
        <a
          href={`/api/files/${file.id}?download=1`}
          className="ml-auto min-h-11 shrink-0 content-center rounded-full px-3 text-sm text-canvas/80 no-underline hover:text-canvas"
        >
          Download
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-canvas/15 text-base text-canvas"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 px-[18px] pb-6">
        {isImage(file.mime) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${file.id}`}
            alt={file.name}
            className="h-full w-full rounded-xl object-contain"
          />
        ) : (
          <iframe
            src={`/api/files/${file.id}`}
            title={file.name}
            className="h-full w-full rounded-xl border-0 bg-surface"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
